import type { RouterConfig } from '@nuxt/schema'

/**
 * 換頁時的捲動位置：
 *   - 換到其他頁：瞬間回到頂端（behavior: instant）。全站 CSS 設了 scroll-behavior: smooth，
 *     沿用 Nuxt 預設會變成平滑捲動，從頁尾換頁時會看到新頁面被快速拉回首屏；
 *     實際上捲動歸零發生在換頁轉場的方塊蓋滿畫面期間（見 plugins/page-transition.client.ts）
 *   - 同一頁內只改 hash（例如 /gallery#works）：不自動捲動，由各頁自行換算位置
 */
export default <RouterConfig>{
  scrollBehavior(to, from) {
    if (to.path === from.path) return false
    return { left: 0, top: 0, behavior: 'instant' }
  }
}
