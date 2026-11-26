import { createHash } from 'node:crypto'
import type { GalleryItem, GalleryResponse } from '#shared/gallery'
import { extra, overrides } from '../../content/behance-works'
import fallback from '../../fallback/behance-works.json'
import { fetchBehanceWorks, type BehanceWork } from '../../utils/behance'
import { cachedSource } from '../../utils/cachedSource'
import { fromBehance } from '../../utils/gallery'

/**
 * GET /api/gallery/works：Behance 作品。
 * 以 runtimeConfig.behance.username（NUXT_BEHANCE_USERNAME）讀取個人 RSS ＋ oEmbed（見 server/utils/behance.ts），
 * 再合併 server/content/behance-works.ts 的手動補充（較早作品、描述、類別、隱藏）。
 *
 * 取得順序（防呆，見 server/utils/cachedSource.ts）：
 *   1. live：快取 6 小時內直接回傳（作品不常更新）；過期則重新向 Behance 取得
 *   2. stale：取不到時，改用最近一次成功取得的資料（30 天內；Behance 圖片網址不會過期）
 *   3. fallback：都沒有時，回傳備用內容 server/fallback/behance-works.json
 * 未設定帳號時直接使用備用內容。
 */

const time = (item: GalleryItem) => (item.date ? Date.parse(item.date) : -Infinity)

const toItems = (works: BehanceWork[]) =>
  works
    .filter((work) => !overrides[work.id]?.hidden)
    .map((work) => fromBehance(work, overrides[work.id]))
    .sort((a, b) => time(b) - time(a)) // 新到舊；沒有日期的排最後（維持原順序）

export default defineEventHandler(async (): Promise<GalleryResponse> => {
  const { username } = useRuntimeConfig().behance
  const fallbackWorks = () => fallback.works as BehanceWork[]
  if (!username) return { category: 'works', items: toItems(fallbackWorks()), source: 'fallback' }

  const { data, source } = await cachedSource({
    // extra 清單變更時換一個快取鍵，新加的作品立即生效
    key: `behance:works:${username}:${createHash('sha256').update(extra.join()).digest('hex').slice(0, 8)}`,
    label: 'gallery/works',
    freshFor: 6 * 60 * 60 * 1000, // 6 小時
    staleFor: 30 * 24 * 60 * 60 * 1000, // 30 天
    fetch: () => fetchBehanceWorks(username, extra),
    fallback: fallbackWorks
  })
  // 手動補充在快取之後才合併：修改 behance-works.ts 立即生效，不必等快取過期
  return { category: 'works', items: toItems(data), source }
})
