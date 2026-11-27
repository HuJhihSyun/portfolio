// 網站與個人的 SEO 基本資料：各頁的標題 / 描述 / 分享卡片、首頁的 h1 與結構化資料（JSON-LD）共用，修改只需改這裡。
// 正式網域由環境變數 NUXT_PUBLIC_SITE_URL 設定（見 .env.example）；未設定時以目前請求的網址推算。

export const SITE = {
  name: 'Jhih-Syun Hu',
  nickname: 'Syun',
  // 中文姓名：填入後會加進頁面標題與結構化資料（台灣使用者常以中文姓名搜尋）；留空則不輸出
  nameZh: '',
  jobTitle: 'Senior Front-End Engineer & Designer',
  jobTitleZh: '資深前端工程師暨網頁設計師',
  siteName: 'Syun Portfolio',
  locale: 'zh_TW',
  ogImage: '/og-image.jpg', // 分享卡片圖（1200×630，放在 public/）
  // 專長關鍵字（結構化資料 knowsAbout）
  skills: [
    'Vue.js',
    'Nuxt',
    'TypeScript',
    'GSAP',
    'D3.js',
    'Three.js',
    'Tailwind CSS',
    'Web Performance',
    'UI/UX Design'
  ]
}

// 姓名顯示：有中文姓名時為「中文名 Jhih-Syun Hu」，否則為「Jhih-Syun Hu」
export const displayName = () => (SITE.nameZh ? `${SITE.nameZh} ${SITE.name}` : `${SITE.name}`)

// 各頁的標題與描述（描述以中文為主、夾帶英文關鍵字，兼顧中文與英文搜尋）
export const PAGES = {
  home: {
    path: '/',
    title: () => `${displayName()}｜${SITE.jobTitleZh} Portfolio`,
    description: () =>
      `${displayName()} 的個人作品集。${SITE.jobTitleZh}（${SITE.jobTitle}），專精 Vue / Nuxt、GSAP 互動動畫、D3.js 資料視覺化與網站效能優化（LCP / CLS），以設計結合程式打造沉浸式網頁體驗。`
  },
  articles: {
    path: '/articles',
    title: () => `Articles｜${displayName()} 的前端開發與互動設計筆記`,
    description: () =>
      `${displayName()} 的 Articles：前端開發（Vue / Nuxt）、GSAP 互動動畫與網頁設計的筆記與心得。`
  },
  gallery: {
    path: '/gallery',
    title: () => `Gallery｜${displayName()} 的 Instagram 日常與創作紀錄`,
    description: () =>
      `${displayName()} 的 Gallery：Instagram 日常紀錄，包含街舞（Breaking）、城市散步，以及網站設計與互動動畫實驗的幕後片段。`
  }
} as const

// 站內分頁（側選單的分頁清單、換頁轉場顯示的頁碼 / 名稱共用）：to 為 null 表示尚未製作、先不可點
export const NAV_PAGES: { label: string; page: string; to: string | null }[] = [
  { label: 'Home', page: '001', to: '/' },
  { label: 'Articles', page: '002', to: '/articles' },
  { label: 'Gallery', page: '003', to: '/gallery' }
]
