# Setup

* Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.
* Make sure to install dependencies: `pnpm install`
* Development Server: Start the development server on `http://localhost:3000` with `pnpm dev`
* Build the application for production with `pnpm build`
* Locally preview production build with `pnpm preview`
* Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

---

# 參考網站

- https://styleport.co.jp/
- https://www.kprverse.com/

---

# Technical 套件或技術

### Nuxt Svgo Loader
* [Nuxt Svgo Loader](https://www.npmjs.com/package/nuxt-svgo-loader)
* SVG ICON Resource [Lucide](https://lucide.dev/)

### TailwindCss v3
[TailwindCss](https://v3.tailwindcss.com/docs/installation) 設定 extend(screens、colors、backgroundImage)、darkMode
assets/css/main.css 設定全域顏色 (對有暗色切換網站專案較適合)

### vue3 + TypeScript With ESLint + Prettier
[ESLint + Prettier](https://juejin.cn/post/7220606022787022906)

1. Install eslint `pnpm i -D eslint eslint-plugin-vue @typescript-eslint/parser @typescript-eslint/eslint-plugin`
2. Install prettier `pnpm i -D prettier eslint-config-prettier eslint-plugin-prettier`
3. Add file .eslintrc.cjs
4. Add file .prettierrc.cjs
5. Add file .vscode/settings.json
6. Add file .editorconfig

### VueUse
[VueUse](https://vueuse.org/guide/)
* useWindowSize: 監聽視窗尺寸變化
* useResizeObserver: 監聽元素尺寸變化
* useVModel: 組件的雙向綁定通常透過 v-model 來完成，更清楚地控制父子組件之間的資料流，並能根據需求對資料進行轉換或處理。
* useState: 輕量級全域狀態管理工具，底層是透過 Nuxt 提供的 useState API 封裝。用途類似小型應用中管理全域變數，不需額外像 Vuex、Pinia 完整的狀態管理框架
* [useScroll](https://vueuse.org/core/useScroll/): x 值 / y 值 / isScrolling 滑動中 / directions 方向 (left/right/top/bottom)
* [useLocalStorage](https://vueuse.org/core/useLocalStorage/): ex.username = useLocalStorage('username', '預設名稱')
* onClickOutside: 點擊 target 以外區域觸發 callback 函式

### .env 環境變數
nuxt.config.ts runtimeConfig => page: useRuntimeConfig()

---

# Google Search Console & Analytics 安裝與設定流程

### Google Analytics 4（GA4）

**套件：** [`nuxt-gtag`](https://www.npmjs.com/package/nuxt-gtag)

1. 安裝套件
   ```bash
   pnpm add nuxt-gtag
   ```

2. 在 `nuxt.config.ts` 的 `modules` 加入設定
   ```ts
   modules: [
     ['nuxt-gtag', { id: 'G-XXXXXXXXXX' }]
   ]
   ```
   `G-XXXXXXXXXX` 替換為 GA4 資源的「評估 ID」（在 GA4 後台 → 管理 → 資料串流 → 串流詳情中取得）

3. 套件會自動注入 gtag.js 並追蹤頁面瀏覽。自訂事件使用 `useGtag()` composable：
   ```ts
   const { gtag } = useGtag()
   gtag('event', 'event_name', { param_key: 'value' })
   ```

**已實作的自訂事件：**

| 事件名稱 | 觸發時機 | 參數 |
|---|---|---|
| `comment_submit` | 留言送出成功 | `article_slug`, `article_title` |
| `share` | 點擊社群分享或複製連結 | `method`（facebook / x / line / copy_link）、`content_type`、`item_id` |

---

### Google Search Console

1. 前往 [Google Search Console](https://search.google.com/search-console) 新增資源
2. 選擇「網址前置字元」，輸入網站完整 URL
3. 驗證方式選擇「HTML 標記」，取得 `<meta>` 驗證碼
4. 在 `nuxt.config.ts` 的 `app.head` 加入：
   ```ts
   app: {
     head: {
       meta: [
         { name: 'google-site-verification', content: 'XXXXXXXXXXXXXXX' }
       ]
     }
   }
   ```
5. 部署後回到 Search Console 點擊「驗證」

**GA4 與 Search Console 連結：**
Search Console → 設定 → 關聯 → Google Analytics，選擇對應的 GA4 資源即可在 Search Console 中看到搜尋成效資料。
