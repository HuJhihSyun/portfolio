import type { GalleryResponse } from '#shared/gallery'
import mock from '../../mock/instagram-media.json'
import { fromInstagram, type InstagramMedia } from '../../utils/gallery'

/**
 * GET /api/gallery/posts：Instagram 貼文。
 * 目前回傳假資料（server/mock/instagram-media.json，格式同 Instagram API 的 /me/media）。
 * 正式串接時改為以 runtimeConfig 中的存取權杖呼叫
 * https://graph.instagram.com/me/media?fields=...，並加上快取（例如 defineCachedEventHandler）；
 * 注意 media_url 是有時效的 CDN 連結，不可長期保存。
 */
export default defineEventHandler(
  (): GalleryResponse => ({
    category: 'posts',
    items: (mock.data as InstagramMedia[]).map(fromInstagram)
  })
)
