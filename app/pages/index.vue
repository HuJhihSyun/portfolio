<script lang="ts" setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'

  import mainPic from '@/assets/images/main.png'

  gsap.registerPlugin(ScrollTrigger)

  const { tiltStyle } = useTilt({ max: 1, scale: 1.06 })

  const root = ref<HTMLElement | null>(null)
  const bgWrap = ref<HTMLElement | null>(null)
  const panelWrap = ref<HTMLElement | null>(null)
  const panelRef = ref<{
    scrambleOut: () => void
    scrambleIn: () => void
    revealOut: () => void
    revealIn: () => void
    $refs: { headerText: HTMLElement; characterWrap: HTMLElement }
  } | null>(null)
  let headerExited = false // 左上亂碼 + 右下 line-reveal 標題是否已退場（避免每個影格重複觸發）

  // 依捲動進度把 Panel 的主題色由白補間到黑（設定 CSS 變數，會繼承進 Panel 內部）
  const updatePanelTheme = (self: { progress: number }) => {
    const el = panelWrap.value
    if (!el) return
    const fg = Math.round(255 * (1 - self.progress)) // 前景：白(255) → 黑(0)
    const bg = 255 - fg // 背景：黑(0) → 白(255)
    el.style.setProperty('--panel-fg', `rgb(${fg} ${fg} ${fg})`)
    el.style.setProperty('--panel-bg', `rgb(${bg} ${bg} ${bg})`)
    el.style.setProperty('--panel-line', `rgb(${fg} ${fg} ${fg} / 0.5)`) // 框線：前景色 50% 透明
  }

  const tl = gsap.timeline()

  onMounted(() => {
    tl.to(bgWrap.value, {
      // 縮成右下角的小圖（因為錨定 right/bottom，寬高縮小時會往右下收）
      width: '350px', // pic ratio 7:4
      height: '200px',
      left: 'calc(33.3% + 12px)', // 右邊距 = 33.3% + Panel padding
      bottom: '48px',
      borderRadius: '16px',
      ease: 'none',
      scrollTrigger: {
        trigger: root.value,
        start: 'top top',
        end: 'bottom bottom', // 捲到 root 底部時剛好播完
        scrub: 0.5, // 讓縮放平滑跟隨捲動
        invalidateOnRefresh: true, // 視窗尺寸變更時重新計算
        onUpdate: (self) => {
          updatePanelTheme(self) // 同一組捲動同步變更 Panel 配色
        }
      }
    })
      .to(
        panelRef.value?.$refs.headerText,
        {
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: root.value,
            start: 'top top',
            end: 'bottom bottom', // 捲到 root 底部時剛好播完
            scrub: 0.5, // 讓縮放平滑跟隨捲動
            invalidateOnRefresh: true, // 視窗尺寸變更時重新計算
            onUpdate: (self) => {
              // 開始下捲 → 左上亂碼解散成空字串、右下標題播 line-reveal 退場；
              // 捲回頂端 → 兩者還原（各只觸發一次）
              if (self.progress > 0.02 && !headerExited) {
                headerExited = true
                panelRef.value?.scrambleOut()
                panelRef.value?.revealOut()
              } else if (self.progress <= 0.02 && headerExited) {
                headerExited = false
                panelRef.value?.scrambleIn()
                panelRef.value?.revealIn()
              }

              // 依「實際渲染透明度」切換 display（讀當前值而非捲動進度，避開 scrub 延遲造成的殘影）：
              // 幾乎全透明時設 display:none，讓文字完全隱形後不再佔據版面、影響其他物件；
              // 回捲重新變得可見時，還原成 CSS 預設的 display。
              const el = panelRef.value?.$refs.headerText
              if (el) {
                const opacity = Number(gsap.getProperty(el, 'opacity'))
                el.style.display = opacity <= 0.01 ? 'none' : ''
              }
            }
          }
        },
        '<'
      )
      .fromTo(
        panelRef.value?.$refs.characterWrap,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root.value,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.5,
            invalidateOnRefresh: true
          }
        }
      )
  })

  onBeforeUnmount(() => {
    tl.scrollTrigger?.kill()
    tl.kill()
  })
</script>

<template>
  <div ref="root" class="w-full">
    <div ref="panelWrap" class="relative w-full p-6 z-10">
      <Panel ref="panelRef" />
    </div>

    <!-- 背景大圖：固定定位，往下捲時縮成右下角小圖 -->
    <div ref="bgWrap" class="fixed right-0 bottom-0 w-screen h-dvh z-0 overflow-hidden perspective-[1000px]">
      <img
        :src="mainPic"
        alt="main"
        class="w-full h-full object-cover will-change-transform"
        :style="{ transform: tiltStyle }"
      />
    </div>

    <!-- 製造捲動距離，讓 ScrollTrigger 有可捲動的範圍 -->
    <section class="relative z-10 h-[150vh] pointer-events-none"></section>
  </div>
</template>
