import type { GalleryResponse } from '#shared/gallery'
import fallback from '../../fallback/instagram-posts.json'
import { cachedSource } from '../../utils/cachedSource'
import { fromInstagram, type InstagramMedia } from '../../utils/gallery'
import { getInstagramToken, invalidateInstagramToken } from '../../utils/instagramToken'

/**
 * GET /api/gallery/posts：Instagram 貼文。
 * 以 runtimeConfig.instagram 的帳號編號呼叫 Graph API（透過 Facebook 登入的 Instagram API）：
 *   GET https://graph.facebook.com/{version}/{ig-user-id}/media?fields=...
 * 權杖由 getInstagramToken() 自動維護（見 server/utils/instagramToken.ts）。
 *
 * 取得順序（防呆，見 server/utils/cachedSource.ts）：
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

type GraphError = { error?: { message?: string; code?: number } }

const fallbackItems = () => (fallback.data as InstagramMedia[]).map(fromInstagram)

const fetchLive = async () => {
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

  const { data, source } = await cachedSource({
    key: 'instagram:posts',
    label: 'gallery/posts',
    freshFor: 30 * 60 * 1000, // 30 分鐘
    staleFor: 3 * 24 * 60 * 60 * 1000, // 3 天（Instagram 圖片網址有時效）
    fetch: fetchLive,
    fallback: fallbackItems,
    // 只記錄 Graph API 的錯誤說明（不記錄完整請求，避免權杖出現在 log）
    describeError: async (err) => {
      const detail = (err as { data?: GraphError }).data?.error
      // 權杖錯誤（code 190）：下次取用時立即重新檢查 / 交換權杖
      if (detail?.code === 190) await invalidateInstagramToken()
      const reason = detail?.message ?? (err as { cause?: { code?: string } }).cause?.code ?? (err as Error).message
      return `${detail?.code ?? ''} ${reason}`.trim()
    }
  })
  return { category: 'posts', items: data, source }
})
