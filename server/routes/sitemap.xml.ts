import { PAGES } from '#shared/site'

/**
 * GET /sitemap.xml：網站地圖，列出所有可被索引的頁面（來自 shared/site.ts 的 PAGES）。
 * 網址以 NUXT_PUBLIC_SITE_URL 為準，未設定時以目前請求的網址推算。
 */
export default defineEventHandler((event) => {
  const base = (String(useRuntimeConfig(event).public.siteUrl || '') || getRequestURL(event).origin).replace(/\/$/, '')
  const urls = Object.values(PAGES)
    .map((page) => `  <url>\n    <loc>${base}${page.path}</loc>\n  </url>`)
    .join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
})
