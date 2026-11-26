<script setup lang="ts">
  import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { NAV_PAGES } from '#shared/site'

  /**
   * PageTransition：站內換頁的轉場遮罩（沿用開場 AppLoading 的黑色方塊格語彙）。
   *   1. cover：方塊由左往右依序放大、蓋滿整個畫面，中央浮現終端機式的讀取訊息
   *      （沿用 Contact 區 Console 的小灰字逐字解碼＋閃爍游標，營造程式讀取的感覺）
   *   2. 蓋滿期間：換頁、捲動位置瞬間歸零（看不到頁面被拉回頂端）、等新頁面載入完成
   *   3. reveal：方塊同樣由左往右依序縮小退去，露出新頁面（新頁面的進場動畫同時開始）
   * 由 plugins/page-transition.client.ts 在路由切換時透過 usePageTransition() 呼叫。
   */

  type HackyTextExpose = { play: (delay?: number) => void; hide: () => void }

  const active = ref(false) // 轉場期間才渲染方塊
  const cols = ref(16)
  const rows = ref(9)
  const lines = ref<string[]>([]) // 讀取訊息（依目標頁產生）
  const lineTexts: HackyTextExpose[] = []

  const root = ref<HTMLElement | null>(null)
  const hud = ref<HTMLElement | null>(null)

  const BOX_DUR = 0.32 // 每個方塊縮放的時間
  const SWEEP = 0.34 // 由左到右掃過整個畫面的錯開時間
  const MIN_HOLD = 550 // 蓋滿後至少停留（毫秒），讓讀取訊息大致解碼完成
  const LINE_STAGGER = 140 // 讀取訊息逐行開始解碼的間隔（毫秒）

  let reduceMotion = false
  let covering: Promise<void> | null = null
  let coveredAt = 0

  const boxes = () => [...(root.value?.querySelectorAll<HTMLElement>('.pt-box') ?? [])]
  const stagger = () => ({ amount: SWEEP, grid: [rows.value, cols.value] as [number, number], from: 'start' as const, axis: 'x' as const })

  // 方塊盡量接近正方形：寬度切成固定欄數（行動版較少），列數依畫面高度換算
  const layout = () => {
    cols.value = window.innerWidth < 768 ? 7 : 16
    rows.value = Math.ceil(window.innerHeight / (window.innerWidth / cols.value))
  }

  const cover = (path: string) => {
    if (covering) return covering
    covering = (async () => {
      const page = NAV_PAGES.find((item) => item.to === path)
      lines.value = [
        `// Routing → ${page?.label ?? path}`,
        `> Page: ${page?.page ?? '---'}`,
        `> Path: ${path}`,
        'Loading resources...'
      ]
      layout()
      active.value = true
      await nextTick()
      // 方塊掃過約一半時開始逐行解碼（文字只出現在已蓋住的深色底上）
      gsap.set(hud.value, { autoAlpha: 1 })
      lineTexts.forEach((text, i) => text?.play((reduceMotion ? 0 : SWEEP * 500) + i * LINE_STAGGER))
      if (reduceMotion) {
        await gsap.fromTo(root.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 })
        gsap.set(boxes(), { scale: 1 })
      } else {
        await gsap.fromTo(boxes(), { scale: 0 }, { scale: 1, duration: BOX_DUR, ease: 'power2.out', stagger: stagger() })
      }
      coveredAt = performance.now()
    })()
    return covering
  }

  const reveal = async () => {
    if (!covering) return
    await covering
    const wait = MIN_HOLD - (performance.now() - coveredAt)
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    gsap.to(hud.value, { autoAlpha: 0, duration: 0.2 })
    if (reduceMotion) {
      await gsap.to(root.value, { autoAlpha: 0, duration: 0.2 })
    } else {
      await gsap.to(boxes(), { scale: 0, duration: BOX_DUR, ease: 'power2.in', stagger: stagger(), delay: 0.1 })
    }
    lineTexts.forEach((text) => text?.hide())
    active.value = false
    covering = null
  }

  let unregister: (() => void) | null = null
  onMounted(() => {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    unregister = usePageTransition().register({ cover, reveal })
  })
  onBeforeUnmount(() => unregister?.())
</script>

<template>
  <div v-if="active" ref="root" class="page-transition fixed inset-0 z-[100]" aria-hidden="true">
    <div
      class="pt-boxes absolute inset-0 grid"
      :style="{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }"
    >
      <span v-for="n in cols * rows" :key="n" class="pt-box"></span>
    </div>
    <!-- 讀取訊息：同 Contact 區 Console（小灰字逐字解碼、最後一行閃爍游標） -->
    <div ref="hud" class="pt-hud absolute inset-0 flex items-center justify-center text-white">
      <div class="pt-console">
        <p v-for="(text, i) in lines" :key="i">
          <AtomsHackyText
            :ref="(el) => (lineTexts[i] = el as unknown as HackyTextExpose)"
            :text="text"
            :speed="2.2"
            hidden
          /><span v-if="i === lines.length - 1" class="pt-cursor">_</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* 轉場期間擋住所有點擊 */
  .page-transition {
    pointer-events: auto;
  }

  .pt-box {
    background: #0b0b0b;
    /* 同 AppLoading：四邊外擴 0.5px 與相鄰方塊重疊，消除小數寬度造成的髮絲縫 */
    margin: -0.5px;
    transform: scale(0);
    will-change: transform;
  }

  .pt-hud {
    visibility: hidden;
  }

  /* 同 Contact 區 Console：10px 小字、半透明 */
  .pt-console {
    min-width: 13rem;
    font-size: 10px;
    line-height: 1.5;
    letter-spacing: 0.02em;
    white-space: nowrap;
    opacity: 0.6;
  }

  .pt-cursor {
    margin-left: 2px;
    animation: pt-blink 1s steps(1) infinite;
  }

  @keyframes pt-blink {
    50% {
      opacity: 0;
    }
  }
</style>
