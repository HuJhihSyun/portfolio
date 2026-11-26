/**
 * Behance 作品取得。
 * Behance 官方 API 已停止核發金鑰，改用以下兩個公開、免金鑰的來源：
 *   1. 個人 RSS：https://www.behance.net/feeds/user?username={帳號}
 *      → 最新 12 件作品的網址、封面、發佈時間、描述
 *      注意：RSS 會把中文等非英文字元變成「?」，因此標題改由 oEmbed 取得，描述只在沒有亂碼時採用
 *   2. oEmbed：https://www.behance.net/services/oembed?url={作品網址}
 *      → 正確的作品標題（含中文）與作者
 * RSS 只列最新 12 件；更早的作品可在 server/content/behance-works.ts 的 extra 手動加入，
 * 會從作品的嵌入頁（/embed/project/{id}）讀取標題與封面（非正式介面，讀不到時略過該件）。
 */

export interface BehanceWork {
  id: string
  title: string // 作品標題（Behance 上的原始標題，含【網頁設計】等前綴）
  url: string
  cover: string // 封面圖（最寬 808px 的 WebP）
  publishedAt?: string // ISO 8601；extra 作品取不到時為空
  description: string // RSS 的描述；含亂碼時為空字串
  author?: string // 作品擁有者（第一位）
}

const BASE = 'https://www.behance.net'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioBot/1.0)' }
const TIMEOUT = 10_000

const decode = (text: string) =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const cdata = (item: string, tag: string) =>
  item.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`))?.[1] ?? ''

// RSS 亂碼判斷：Behance 把非英文字元輸出成「?」，連續兩個以上就視為亂碼
const garbled = (text: string) => /\?{2,}/.test(text)

// 封面改用較大的尺寸：/projects/404/xxx → /projects/max_808_webp/xxx
const largeCover = (url: string) => url.replace(/\/projects\/\d+(?:_webp)?\//, '/projects/max_808_webp/')

export const projectId = (url: string) => url.match(/\/gallery\/(\d+)/)?.[1] ?? ''

/** 讀取個人 RSS（不含正確中文標題） */
const fetchFeed = async (username: string): Promise<BehanceWork[]> => {
  const xml = await $fetch<string>(`${BASE}/feeds/user`, {
    query: { username },
    headers: HEADERS,
    responseType: 'text',
    timeout: TIMEOUT
  })
  if (!xml.includes('<rss')) throw new Error('unexpected RSS response')

  const works = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item = '']) => {
    const url = cdata(item, 'link').trim()
    const id = projectId(url)
    if (!id) return []
    const html = cdata(item, 'description')
    const cover = html.match(/<img[^>]+src=['"]([^'"]+)['"]/)?.[1] ?? ''
    const description = decode(html)
    const title = decode(cdata(item, 'title'))
    const date = new Date(cdata(item, 'pubDate'))
    return [
      {
        id,
        url,
        title: garbled(title) ? '' : title,
        cover: cover && largeCover(cover),
        publishedAt: Number.isNaN(date.getTime()) ? undefined : date.toISOString(),
        description: garbled(description) ? '' : description
      }
    ]
  })
  // 帳號不存在或改名時 RSS 仍回傳 200 但沒有作品：視為失敗，改用最近一次的資料或備用內容
  if (!works.length) throw new Error('RSS has no projects (check the username)')
  return works
}

/** oEmbed：正確的標題與作者；失敗時回傳 null（不影響其他作品） */
const fetchOEmbed = async (url: string) => {
  try {
    const res = await $fetch<{ title?: string; author_name?: string }>(`${BASE}/services/oembed`, {
      query: { url },
      headers: HEADERS,
      timeout: TIMEOUT
    })
    return { title: res.title ?? '', author: res.author_name }
  } catch {
    return null
  }
}

/** 嵌入頁：extra 作品的標題、網址與封面（非正式介面）；失敗時回傳 null */
const fetchEmbed = async (id: string): Promise<BehanceWork | null> => {
  try {
    const html = await $fetch<string>(`${BASE}/embed/project/${id}`, {
      headers: HEADERS,
      responseType: 'text',
      timeout: TIMEOUT
    })
    const json = html.match(/<script type="application\/json" id="beconfig-store_state">([\s\S]*?)<\/script>/)?.[1]
    const project = json && JSON.parse(json)?.embedStore?.project
    if (!project?.name) return null
    const covers = project.covers ?? {}
    const cover = covers.size_max_808_webp?.url ?? covers.size_808_webp?.url ?? covers.size_404_webp?.url ?? ''
    return {
      id,
      url: project.url ?? `${BASE}/gallery/${id}`,
      title: project.name,
      cover,
      description: '',
      author: project.owners?.[0]?.displayName
    }
  } catch {
    return null
  }
}

/** 取得作品清單：RSS 最新作品（補上 oEmbed 標題）＋手動加入的較早作品 */
export const fetchBehanceWorks = async (username: string, extra: string[] = []): Promise<BehanceWork[]> => {
  const feed = await fetchFeed(username) // RSS 失敗就整批失敗，交由快取 / 備用內容處理

  const latest = await Promise.all(
    feed.map(async (work) => {
      const meta = await fetchOEmbed(work.url)
      return { ...work, title: meta?.title || work.title, author: meta?.author }
    })
  )

  const known = new Set(latest.map((work) => work.id))
  const extraIds = extra.map((entry) => projectId(entry) || entry.trim()).filter((id) => /^\d+$/.test(id) && !known.has(id))
  const older = (await Promise.all([...new Set(extraIds)].map(fetchEmbed))).filter((work) => work !== null)

  return [...latest, ...older]
}
