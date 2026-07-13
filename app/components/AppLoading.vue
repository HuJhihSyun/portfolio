<script setup lang="ts">
  import { ref, watch, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'

  const { finish } = useGlobalLoading()

  // message 文字隨機切換
  const messages = [
    'SYSTEM INITIALIZING',
    'LOADING ASSETS',
    'FETCHING DATA',
    'PREPARING UI',
    'CONFIGURING ENVIRONMENT',
    'STARTING SERVICES'
  ]
  const message = ref(messages[0])

  // 開場動畫的顯示狀態由元件自身控制（確保每次載入都完整播 3 秒），播完再同步關閉全域 loading
  const show = ref(true)

  // 背景方塊格（stagger 流動用）。grid 為 [列, 行]，需與 CSS 的 grid-template 一致
  const COLS = 32
  const ROWS = 18
  const total = COLS * ROWS

  const root = ref<HTMLElement | null>(null)
  const hud = ref<HTMLElement | null>(null)
  const percent = ref(0) // 進度百分比（驅動進度條寬度與數字）

  let master: gsap.core.Timeline | null = null
  let flow: gsap.core.Tween | null = null
  let msgTween: gsap.core.Tween | null = null
  let started = false

  const startIntro = (el: HTMLElement) => {
    const boxes = Array.from(el.querySelectorAll<HTMLElement>('.box'))
    gsap.set(boxes, { transformOrigin: 'center' })

    // 方塊持續「流動」：以中心為源、grid stagger 讓縮放像波紋一樣擴散（loading 期間循環）
    flow = gsap.to(boxes, {
      backgroundColor: 'rgba(0, 0, 0, 1)',
      duration: 0.9,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
      stagger: { each: 0.045, grid: [ROWS, COLS], from: 'center' }
    })

    // 訊息文字每秒隨機切換：用 gsap 空 tween 的 onRepeat 取代 setInterval（client-only、隨動畫清理）
    msgTween = gsap.to(
      {},
      {
        duration: 1,
        repeat: -1,
        onRepeat: () => (message.value = gsap.utils.random(messages))
      }
    )

    // 主時間軸：整體 3 秒。進度條/百分比 → 收場（方塊 stagger 縮小 + 遮罩淡出）→ finish()
    const counter = { v: 0 }
    master = gsap.timeline({
      onComplete: () => {
        show.value = false // 移除遮罩，露出主畫面
        finish() // 同步關閉全域 loading state
      }
    })

    master
      // 0 ~ 2.3s：百分比 0 → 100（同步驅動進度條寬度）
      .to(
        counter,
        {
          v: 100,
          duration: 2.2,
          ease: 'power1.inOut',
          onUpdate: () => (percent.value = Math.round(counter.v))
        },
        0
      )
      // 收場前先停下流動與訊息切換，交給收場的縮小動畫接手
      .add(() => {
        flow?.kill()
        msgTween?.kill()
      }, 2.2)
      // 方塊由邊緣往內 stagger 縮成 0（流動性地消失）
      .to(
        boxes,
        {
          scale: 0,
          duration: 0.55,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          stagger: { each: 0.005, grid: [ROWS, COLS], from: 'edges' }
        },
        2.2
      )
      .to(
        hud.value,
        {
          opacity: 0,
          duration: 0.2,
          ease: 'power2.inOut'
        },
        '<'
      )
      // 整個 loading 遮罩淡出，於第 3 秒收尾
      .to(el, { autoAlpha: 0, duration: 0.4, ease: 'power2.inOut' }, 2.6)
  }

  // 等 root 元素實際掛載後才啟動 gsap 動畫（SSR 先渲染靜態遮罩，client 掛載後接手播放）
  watch(
    root,
    (el) => {
      if (!el || started) return
      started = true
      startIntro(el)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    flow?.kill()
    master?.kill()
    msgTween?.kill()
  })
</script>

<template>
  <div v-if="show" ref="root" class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
    <!-- 背景流動方塊格 -->
    <div
      class="boxes absolute inset-0 grid"
      :style="{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }"
    >
      <div v-for="n in total" :key="n" class="box"></div>
    </div>

    <div ref="hud" class="relative w-full z-10 flex flex-col items-center">
      <div class="w-1/3 flex flex-col gap-2 text-white">
        <div class="flex justify-start items-start leading-none">
          <span class="text-sm tracking-widest">Loading - {{ String(percent).padStart(3, '0') }}</span>
          <span class="text-sm">%</span>
        </div>
        <div class="relative h-0.5 bg-white/10 overflow-hidden">
          <div
            class="absolute inset-0 h-full bg-linear-to-r from-[#bbb] to-[#aaa]"
            :style="{ width: percent + '%' }"
          ></div>
          <div class="bar-scan absolute top-0 left-0 w-2/5 h-full bg-linear-to-r from-white/50 to-white/0"></div>
        </div>
        <div class="text-xs tracking-widest font-light text-right">{{ message || 'SYSTEM INITIALIZING' }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  /* 背景流動方塊格 */
  .boxes {
    .box {
      background: rgba(#111, 1);
      will-change: transform, opacity;
    }
  }

  /* 掃描高光：在填滿條上來回掃動，強化科技感 */
  .bar-scan {
    animation: bar-scan 1.1s linear infinite;
  }

  @keyframes bar-scan {
    0% {
      transform: translateX(-120%);
    }
    100% {
      transform: translateX(320%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar-scan {
      animation: none;
    }
  }
</style>
