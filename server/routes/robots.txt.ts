/**
 * GET /robots.txt：允許所有搜尋引擎爬取，並指向網站地圖（需完整網址，因此改由伺服器產生，取代原本 public/robots.txt）。
 */
export default defineEventHandler((event) => {
  const base = (String(useRuntimeConfig(event).public.siteUrl || '') || getRequestURL(event).origin).replace(/\/$/, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return `User-Agent: *\nDisallow:\n\nSitemap: ${base}/sitemap.xml\n`
})
