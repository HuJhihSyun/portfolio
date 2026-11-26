// Gallery 頁的共用資料格式：前端（GalleryPosts 等 Gallery 元件）與 API（server/api/gallery/*）共用。
// 各來源（Instagram / Behance）的原始格式不同，由 server 端統一轉成 GalleryItem，
// 之後接上真正的 API 只需改 server，前端不用動。

export type GalleryCategory = 'posts' | 'works'

export interface GalleryStat {
  label: string // 例如 Likes / Comments / Views
  value: number
}

export interface GalleryItem {
  id: string
  source: 'instagram' | 'behance'
  image: string // 封面圖網址（Instagram 影片取縮圖）
  video?: string // 影片網址（影片貼文，或第一張為影片的輪播）；有值時卡片轉到中央會自動播放（靜音循環）
  title: string // 作品名稱；Instagram 貼文取內文第一行
  caption: string // 完整內文 / 作品描述
  date: string // ISO 8601
  link: string // 原始貼文 / 作品頁網址
  kind: string // 類型標籤，例如 Carousel · 4、Video、UI/UX
  stats: GalleryStat[]
}

export interface GalleryResponse {
  category: GalleryCategory
  items: GalleryItem[]
  // 資料來源：live = 即時取得；stale = API 暫時取不到，改用最近一次成功取得的資料；fallback = 備用內容
  source?: 'live' | 'stale' | 'fallback'
}
