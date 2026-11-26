import type { GalleryItem } from '#shared/gallery'
import type { BehanceWork } from './behance'

/**
 * 把各來源的原始資料轉成統一的 GalleryItem。
 * 型別對應官方 API 的回傳欄位：
 *   - Instagram：透過 Facebook 登入的 Instagram API，GET /{ig-user-id}/media（graph.facebook.com）
 *     （fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{...}）
 *   - Behance：官方 API 已停止核發金鑰，改由個人 RSS ＋ oEmbed 取得（見 server/utils/behance.ts），
 *     再合併 server/content/behance-works.ts 的手動補充
 */

export interface InstagramMedia {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string
  thumbnail_url?: string
  permalink: string
  timestamp: string
  like_count?: number
  comments_count?: number
  children?: { data: { id?: string; media_type: string; media_url: string; thumbnail_url?: string }[] }
}

const MEDIA_KIND: Record<InstagramMedia['media_type'], string> = {
  IMAGE: 'Photo',
  VIDEO: 'Video',
  CAROUSEL_ALBUM: 'Carousel'
}

// 封面與影片：影片貼文的 media_url 是影片檔，封面改用縮圖；
// 輪播的 media_url 是第一張子項目，若第一張是影片，同樣改用它的縮圖當封面、影片另外存
const cover = (media: InstagramMedia): Pick<GalleryItem, 'image' | 'video'> => {
  if (media.media_type === 'VIDEO') return { image: media.thumbnail_url ?? media.media_url, video: media.media_url }
  const first = media.children?.data[0]
  if (media.media_type === 'CAROUSEL_ALBUM' && first?.media_type === 'VIDEO') {
    return { image: first.thumbnail_url ?? media.thumbnail_url ?? '', video: first.media_url }
  }
  return { image: media.media_url }
}

export const fromInstagram = (media: InstagramMedia): GalleryItem => {
  const caption = media.caption ?? ''
  const count = media.children?.data.length
  return {
    id: media.id,
    source: 'instagram',
    ...cover(media),
    title: caption.split('\n')[0] || 'Untitled',
    caption,
    date: new Date(media.timestamp).toISOString(),
    link: media.permalink,
    kind: count ? `${MEDIA_KIND[media.media_type]} · ${count}` : MEDIA_KIND[media.media_type],
    stats: [
      { label: 'Likes', value: media.like_count ?? 0 },
      { label: 'Comments', value: media.comments_count ?? 0 }
    ]
  }
}

// Behance 標題常帶類別前綴，例如「【網頁設計】…」「平面設計-…」「網頁設計 | …」：拆出類別，其餘當標題
const KIND_PREFIX = /^(?:【([^】]+)】|([\u4e00-\u9fff]{2,6})\s*[-|｜]\s*)/
// 對應 Gallery Works 區的大類（server/content/behance-works.ts 可用「大類 · 細類」覆寫成更細的分類）
const KIND_NAME: Record<string, string> = {
  網頁設計: 'Web',
  網站設計: 'Web',
  平面設計: 'Graphic'
}

export interface BehanceOverride {
  title?: string
  caption?: string
  kind?: string
  date?: string
}

export const fromBehance = (work: BehanceWork, override: BehanceOverride = {}): GalleryItem => {
  const match = work.title.match(KIND_PREFIX)
  const rawKind = match?.[1] ?? match?.[2]
  let title = match ? work.title.slice(match[0].length) : work.title
  // 個人作品的標題結尾常帶「 - 作者名」
  if (work.author && title.endsWith(` - ${work.author}`)) title = title.slice(0, -` - ${work.author}`.length)
  const date = override.date || work.publishedAt

  return {
    id: work.id,
    source: 'behance',
    image: work.cover,
    title: override.title || title.trim() || 'Untitled',
    caption: override.caption || work.description,
    date: date ? new Date(date).toISOString() : '',
    link: work.url,
    kind: override.kind || (rawKind ? (KIND_NAME[rawKind] ?? rawKind) : 'Project'),
    stats: [] // Behance 的讚數 / 觀看數沒有公開管道可取得
  }
}
