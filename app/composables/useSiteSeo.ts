import { SITE, PAGES, displayName } from '#shared/site'
import { CAREER_LINKS, SOCIAL_LINKS } from '#shared/profile'

/** 網站網址（不含結尾斜線）：優先使用 NUXT_PUBLIC_SITE_URL，未設定時以目前請求的網址推算 */
export const useSiteUrl = () => {
  const configured = String(useRuntimeConfig().public.siteUrl || '')
  return (configured || useRequestURL().origin).replace(/\/$/, '')
}

/**
 * 設定頁面的 SEO 標籤：title / description、Open Graph 與 Twitter 分享卡片（LINE、Facebook 分享預覽會讀取）、canonical。
 * 內容來自 shared/site.ts 的 PAGES。
 */
export const useSiteSeo = (key: keyof typeof PAGES) => {
  const page = PAGES[key]
  const base = useSiteUrl()
  const url = `${base}${page.path}`
  const title = page.title()
  const description = page.description()
  const image = `${base}${SITE.ogImage}`

  useSeoMeta({
    title,
    description,
    ogType: 'website',
    ogSiteName: SITE.siteName,
    ogLocale: SITE.locale,
    ogUrl: url,
    ogTitle: title,
    ogDescription: description,
    ogImage: image,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: `${displayName()} — ${SITE.jobTitle}`,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image
  })
  useHead({ link: [{ rel: 'canonical', href: url }] })
}

/**
 * 首頁的結構化資料（JSON-LD）：WebSite + Person。
 * 讓搜尋引擎辨識這是誰的網站（姓名、職稱、專長、各平台帳號），搜尋姓名時較有機會出現資訊卡。
 */
export const usePersonSchema = () => {
  const base = useSiteUrl()
  // 個人檔案連結：排除作品集子頁（同一個 CakeResume 帳號）與 LINE 加好友連結
  const sameAs = [...CAREER_LINKS, ...SOCIAL_LINKS]
    .filter((link) => link.label !== 'LINE' && !link.label.includes('Portfolio'))
    .map((link) => link.url)

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: SITE.siteName,
        inLanguage: 'zh-Hant',
        publisher: { '@id': `${base}/#person` }
      },
      {
        '@type': 'Person',
        '@id': `${base}/#person`,
        name: SITE.name,
        alternateName: [SITE.nickname, SITE.nameZh].filter(Boolean),
        jobTitle: SITE.jobTitle,
        description: PAGES.home.description(),
        url: `${base}/`,
        image: `${base}${SITE.ogImage}`,
        knowsAbout: SITE.skills,
        sameAs
      }
    ]
  }

  useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(graph) }] })
}
