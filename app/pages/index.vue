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
  const panelRef = ref<{ onScrollProgress: (p: number) => void } | null>(null)
  let tween: gsap.core.Tween | null = null

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

  onMounted(() => {
    tween = gsap.to(bgWrap.value, {
      // 縮成右下角的小圖（因為錨定 right/bottom，寬高縮小時會往右下收）
      width: '420px',
      height: '240px',
      right: '104px',
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
          panelRef.value?.onScrollProgress(self.progress) // 通知 Panel 切換 step
        }
      }
    })
  })

  onBeforeUnmount(() => {
    tween?.scrollTrigger?.kill()
    tween?.kill()
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
