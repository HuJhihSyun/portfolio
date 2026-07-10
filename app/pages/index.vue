<script lang="ts" setup>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
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
    aboutIn: () => void
    aboutOut: () => void
    $refs: { headerText: HTMLElement; characterWrap: HTMLElement; characterCard: HTMLElement }
  } | null>(null)
  let headerExited = false // 左上亂碼 + 右下 line-reveal 標題是否已退場（避免每個影格重複觸發）

  // 背景大圖的科技感切角進度（0=矩形 → 1=完整切角），由 ScrollTrigger onUpdate 驅動
  const cornerProgress = ref(0)
  // 各角切角大小隨進度成長（下捲越多、切角越明顯；px 固定，配合縮小後的小圖比例）
  const bgCorners = computed(() => {
    const p = cornerProgress.value
    return {
      topLeft: { type: 'round' as const, size: 18 * p },
      topRight: { type: 'bevel' as const, size: 34 * p },
      bottomRight: { type: 'round' as const, size: 18 * p },
      bottomLeft: { type: 'notch' as const, size: 72 * p, depth: 22 * p, radius: 10 * p }
    }
  })

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

  // 依捲動進度處理：左上亂碼解散/還原、右下標題進退場，並在文字全透明後移出版面
  const updateHeaderText = (self: { progress: number }) => {
    // 開始下捲 → 亂碼解散成空字串、標題播 line-reveal 退場；捲回頂端 → 還原（各只觸發一次）
    if (self.progress > 0.02 && !headerExited) {
      headerExited = true
      panelRef.value?.scrambleOut()
      panelRef.value?.revealOut()
      panelRef.value?.aboutIn() // 右側 nameWrap Block Reveal 顯現 + aboutText 解碼 profileText2
    } else if (self.progress <= 0.02 && headerExited) {
      headerExited = false
      panelRef.value?.scrambleIn()
      panelRef.value?.revealIn()
      panelRef.value?.aboutOut() // 右側還原：nameWrap 退場 + aboutText 清空
    }

    // 依「實際渲染透明度」切換 display（讀當前值而非進度，避開 scrub 延遲殘影）：
    // 全透明後設 display:none 不再佔版面，回捲可見時還原成預設 display。
    const el = panelRef.value?.$refs.headerText
    if (el) {
      const opacity = Number(gsap.getProperty(el, 'opacity'))
      el.style.display = opacity <= 0.01 ? 'none' : ''
    }
  }

  let tl: gsap.core.Timeline | null = null

  onMounted(() => {
    // 所有動畫共用同一段捲動範圍 → 用「單一 ScrollTrigger 驅動一條 timeline」，
    // 各動畫以 position 0 同時開始、同步播放，scrollTrigger 設定只需寫一份。
    tl = gsap.timeline({
      defaults: { ease: 'none', duration: 1 },
      scrollTrigger: {
        trigger: root.value,
        start: 'top top',
        end: 'bottom bottom', // 捲到 root 底部時剛好播完
        scrub: 0.5, // 平滑跟隨捲動
        invalidateOnRefresh: true, // 視窗尺寸變更時重新計算
        onUpdate: (self) => {
          updatePanelTheme(self) // Panel 配色 白 → 黑
          cornerProgress.value = self.progress // 背景大圖長出科技感切角
          updateHeaderText(self) // 左上亂碼 / 右下標題進退場
        }
      }
    })

    tl
      // 背景大圖：縮成右下角小圖（錨定 right/bottom，寬高縮小時往右下收；pic ratio 7:4）
      .to(bgWrap.value, { width: '350px', height: '200px', left: 'calc(33.3% + 12px)', bottom: '48px' }, 0)
      // 左上 profile 文字：淡出
      .to(panelRef.value?.$refs.headerText, { opacity: 0 }, 0)
      // 角色欄整體淡入
      .fromTo(panelRef.value?.$refs.characterWrap, { opacity: 0 }, { opacity: 1 }, 0)
      // 角色卡片：以中心為軸翻轉進入
      .fromTo(
        panelRef.value?.$refs.characterCard,
        { rotationY: -180, opacity: 0 },
        { rotationY: 0, opacity: 1, transformOrigin: 'center' },
        0
      )
      .fromTo(panelRef.value?.$refs.aboutWrap, { opacity: 0 }, { opacity: 1 }, 0)
  })

  onBeforeUnmount(() => {
    tl?.scrollTrigger?.kill()
    tl?.kill()
  })
</script>

<template>
  <div ref="root" class="w-full">
    <div ref="panelWrap" class="relative w-full p-6 z-10">
      <Panel ref="panelRef" />
    </div>

    <!-- 背景大圖：固定定位，往下捲時縮成右下角小圖，並逐漸長出科技感切角 -->
    <div ref="bgWrap" class="fixed right-0 bottom-0 w-screen h-dvh z-0 overflow-hidden perspective-[1000px]">
      <TechFrame
        :strokeWidth="0"
        :top-left="bgCorners.topLeft"
        :top-right="bgCorners.topRight"
        :bottom-right="bgCorners.bottomRight"
        :bottom-left="bgCorners.bottomLeft"
        class="w-full h-full"
      >
        <img
          :src="mainPic"
          alt="main"
          class="w-full h-full object-cover will-change-transform"
          :style="{ transform: tiltStyle }"
        />
      </TechFrame>
    </div>

    <!-- 製造捲動距離，讓 ScrollTrigger 有可捲動的範圍 -->
    <section class="relative z-10 h-[150vh] pointer-events-none"></section>
  </div>
</template>
