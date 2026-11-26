import type { GalleryItem, GalleryResponse } from '#shared/gallery'
import fallback from '../../fallback/instagram-posts.json'
import { fromInstagram, type InstagramMedia } from '../../utils/gallery'
import { getInstagramToken, invalidateInstagramToken } from '../../utils/instagramToken'

/**
 * GET /api/gallery/posts：Instagram 貼文。
 * 以 runtimeConfig.instagram 的帳號編號呼叫 Graph API（透過 Facebook 登入的 Instagram API）：
 *   GET https://graph.facebook.com/{version}/{ig-user-id}/media?fields=...
 * 權杖由 getInstagramToken() 自動維護（見 server/utils/instagramToken.ts）。
 *
 * 取得順序（防呆）：
 *   1. live：快取 30 分鐘內直接回傳；過期則重新向 Instagram 取得
 *   2. stale：取不到（權杖過期、網路或資安工具阻擋等）時，改用最近一次成功取得的資料（3 天內，圖片網址仍有效）
 *   3. fallback：都沒有時，回傳備用內容 server/fallback/instagram-posts.json
 *      （格式同 Instagram API；圖片可放在 public/ 下以 /gallery-fallback/xxx.jpg 引用，或使用完整網址）
 * 未設定權杖時直接使用備用內容。
 * 權杖只在伺服器端使用（放在請求標頭，不出現在網址），不會送到瀏覽器。
 */

const FIELDS = [
  'id',
  'caption',
  'media_type',
  'media_url',
  'thumbnail_url',
  'permalink',
  'timestamp',
  'like_count',
  'comments_count',
  'children{media_type,media_url,thumbnail_url}'
].join(',')

const CACHE_KEY = 'instagram:posts'
const FRESH_FOR = 30 * 60 * 1000 // 快取 30 分鐘
const STALE_FOR = 3 * 24 * 60 * 60 * 1000 // 取不到時，最近一次成功的資料可再用 3 天（Instagram 圖片網址有時效）

interface CachedPosts {
  items: GalleryItem[]
  fetchedAt: number
}

type GraphError = { error?: { message?: string; code?: number; type?: string } }

const fallbackItems = () => (fallback.data as InstagramMedia[]).map(fromInstagram)

let pending: Promise<GalleryItem[]> | null = null // 同一時間只向 Instagram 取一次

const fetchLive = async (): Promise<GalleryItem[]> => {
  const { userId, apiVersion, limit } = useRuntimeConfig().instagram
  const token = await getInstagramToken()
  if (!userId || !token) throw new Error('not configured')

  const res = await $fetch<{ data: InstagramMedia[] }>(`https://graph.facebook.com/${apiVersion}/${userId}/media`, {
    query: { fields: FIELDS, limit },
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10_000
  })
  return res.data.map(fromInstagram)
}

export default defineEventHandler(async (): Promise<GalleryResponse> => {
  const { userId, accessToken } = useRuntimeConfig().instagram
  if (!userId || !accessToken) return { category: 'posts', items: fallbackItems(), source: 'fallback' }

  const storage = useStorage('data')
  const cached = await storage.getItem<CachedPosts>(CACHE_KEY)
  const age = cached ? Date.now() - cached.fetchedAt : Infinity
  if (cached && age < FRESH_FOR) return { category: 'posts', items: cached.items, source: 'live' }

  try {
    pending ??= fetchLive().finally(() => (pending = null))
    const items = await pending
    await storage.setItem(CACHE_KEY, { items, fetchedAt: Date.now() } satisfies CachedPosts)
    return { category: 'posts', items, source: 'live' }
  } catch (err) {
    // 只記錄 Graph API 的錯誤說明（不記錄完整請求，避免權杖出現在 log）
    const detail = (err as { data?: GraphError }).data?.error
    const reason = detail?.message ?? (err as { cause?: { code?: string } }).cause?.code ?? (err as Error).message
    console.error(
      '[gallery/posts] Instagram 取得失敗，改用',
      cached && age < STALE_FOR ? '最近一次的資料' : '備用內容',
      '：',
      detail?.code ?? '',
      reason
    )
    // 權杖錯誤（code 190）：下次取用時立即重新檢查 / 交換權杖
    if (detail?.code === 190) await invalidateInstagramToken()

    if (cached && age < STALE_FOR) return { category: 'posts', items: cached.items, source: 'stale' }
    return { category: 'posts', items: fallbackItems(), source: 'fallback' }
  }
})
