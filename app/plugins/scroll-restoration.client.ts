// 停用瀏覽器「重新整理時記憶捲動位置」的行為，讓每次重整都從頁面最頂端開始
// （配合開場 loading + 延遲建立的 ScrollTrigger，避免從中間區段起算）
export default defineNuxtPlugin(() => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }
  window.scrollTo(0, 0)
})
