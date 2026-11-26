/**
 * 站內換頁轉場（搭配 components/PageTransition.vue）：
 *   1. 路由切換前：方塊蓋滿畫面（beforeEach 等它完成才真正換頁），同時把全域 loading 設為進行中，
 *      新頁面的 onLoaded()（進場動畫、建立捲動動畫）會等到轉場退去才執行
 *   2. 新頁面載入完成（page:finish）：捲動位置瞬間歸零、方塊退去
 * 首次載入（開場 AppLoading 負責）與同一頁內的 hash 變更不做轉場。
 * 捲動歸零的方式見 app/router.options.ts（不用平滑捲動，避免看到頁面被拉回頂端）。
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const { loading } = useGlobalLoading()
  const transition = usePageTransition()
  let active = false

  const finish = () => {
    if (!active) return
    active = false
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    transition.reveal()
    // 方塊開始退去時才放行新頁面的進場（onLoaded），兩者同時進行
    requestAnimationFrame(() => (loading.value = false))
  }

  router.beforeEach(async (to, from) => {
    if (!from.matched.length || to.path === from.path) return
    active = true
    loading.value = true
    await transition.cover(to.path)
  })

  // 換頁失敗或被取消（例如連續點擊）時也要把遮罩收起
  router.afterEach((_to, _from, failure) => {
    if (failure) finish()
  })
  router.onError(() => finish())

  nuxtApp.hook('page:finish', finish)
})
