import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['./app/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        'gsap',
        'three',
        'three/examples/jsm/controls/OrbitControls.js',
        'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/loaders/RGBELoader.js',
        'three/examples/jsm/postprocessing/EffectComposer.js',
        'three/examples/jsm/postprocessing/RenderPass.js',
        'three/examples/jsm/postprocessing/UnrealBloomPass.js'
      ]
    }
  },

  app: {
    head: {
      title: 'Syun | Portfolio', // 備用標題；各頁以 useSiteSeo 設定實際標題（見 shared/site.ts）
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: { lang: 'zh-Hant' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@100..900&family=Quantico:ital,wght@0,400;0,700;1,400;1,700&display=swap'
        },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  // 伺服器端私密設定（只在 server/ 內可讀取，不會送到瀏覽器）。
  // 實際值由環境變數覆寫：NUXT_MAIL_USER / NUXT_MAIL_PASS / NUXT_MAIL_TO（見 .env.example）
  runtimeConfig: {
    mail: {
      user: '', // 寄件的 Gmail 帳號
      pass: '', // Gmail 應用程式密碼（非登入密碼）
      to: '' // 收件信箱；未設定時寄給 user 自己
    },
    // Instagram 貼文（Gallery）：NUXT_INSTAGRAM_*（見 .env.example）。
    // 未設定或取不到時，/api/gallery/posts 改回傳備用內容（server/fallback/instagram-posts.json）
    instagram: {
      userId: '', // Instagram 專業帳號編號（1784… 開頭）
      accessToken: '', // 存取權杖（EAA… 開頭，透過 Facebook 登入的 Instagram API）
      // App 編號與密鑰：用來自動檢查權杖效期、換成不會過期的粉專權杖（未設定則不自動維護，直接使用 accessToken）
      appId: '',
      appSecret: '',
      apiVersion: 'v27.0',
      limit: 12 // 取最新幾則貼文（Gallery 輪盤的長度依此而定）
    },
    // Behance 作品（Gallery Works）：公開帳號，免金鑰；可由 NUXT_BEHANCE_USERNAME 覆寫，設為空字串則改用備用內容。
    // 較早作品、描述、類別等手動補充見 server/content/behance-works.ts
    behance: {
      username: 'cj654vmp2069' // behance.net/ 後面的帳號
    },
    public: {
      // 正式網域（canonical、分享卡片、sitemap 的完整網址）：由 NUXT_PUBLIC_SITE_URL 覆寫；未設定時以目前請求的網址推算
      siteUrl: ''
    }
  },

  modules: ['nuxt-svgo-loader']
})
