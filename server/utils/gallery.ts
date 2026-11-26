import type { GalleryItem } from '#shared/gallery'

/**
 * 把各來源的原始資料轉成統一的 GalleryItem。
 * 型別對應官方 API 的回傳欄位：
 *   - Instagram：透過 Facebook 登入的 Instagram API，GET /{ig-user-id}/media（graph.facebook.com）
 *     （fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{...}）
 *   - Behance：舊版 v2 API 的 projects 格式（官方已停止核發新金鑰，正式串接時可能改用 RSS 或手動維護資料）
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

export interface BehanceProject {
  id: number
  name: string
  description?: string
  url: string
  published_on: number // Unix 秒
  covers: Record<string, string>
  fields: string[]
  stats: { views: number; appreciations: number; comments: number }
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

export const fromBehance = (project: BehanceProject): GalleryItem => ({
  id: String(project.id),
  source: 'behance',
  image: project.covers.original ?? Object.values(project.covers).at(-1) ?? '',
  title: project.name,
  caption: project.description ?? '',
  date: new Date(project.published_on * 1000).toISOString(),
  link: project.url,
  kind: project.fields.join(' / '),
  stats: [
    { label: 'Appreciations', value: project.stats.appreciations },
    { label: 'Views', value: project.stats.views }
  ]
})
