import type { GalleryResponse } from '#shared/gallery'
import mock from '../../mock/behance-projects.json'
import { fromBehance, type BehanceProject } from '../../utils/gallery'

/**
 * GET /api/gallery/works：Behance 作品。
 * 目前回傳假資料（server/mock/behance-projects.json，格式同 Behance v2 API 的 projects）。
 */
export default defineEventHandler(
  (): GalleryResponse => ({
    category: 'works',
    items: (mock.projects as BehanceProject[]).map(fromBehance)
  })
)
