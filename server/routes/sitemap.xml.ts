import { PAGES } from '#shared/site'
import { POSTS } from '#shared/posts'

/**
 * GET /sitemap.xml：網站地圖，列出所有可被索引的頁面（shared/site.ts 的 PAGES ＋ 已發佈的文章 shared/posts/）。
 * 網址以 NUXT_PUBLIC_SITE_URL 為準，未設定時以目前請求的網址推算。
 */
export default defineEventHandler((event) => {
  const base = (String(useRuntimeConfig(event).public.siteUrl || '') || getRequestURL(event).origin).replace(/\/$/, '')
  const pages = Object.values(PAGES).map((page) => `  <url>\n    <loc>${base}${page.path}</loc>\n  </url>`)
  const posts = POSTS.filter((post) => post.status === 'published').map(
    (post) =>
      `  <url>\n    <loc>${base}/articles/${post.slug}</loc>\n    <lastmod>${(post.updatedAt ?? post.publishedAt).slice(0, 10)}</lastmod>\n  </url>`
  )
  const urls = [...pages, ...posts].join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
})
