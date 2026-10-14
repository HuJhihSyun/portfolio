<script setup lang="ts">
  import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'

  type HackyTextExpose = { play: (delay?: number) => void; hide: () => void }

  // 側選單開關（由 Panel 的漢堡按鈕以 v-model:open 控制）
  const open = defineModel<boolean>('open', { default: false })

  // TODO: 目前尚無分頁，先放假資料；有分頁後改為實際路由並依目前頁面決定 active
  const navList = [
    { label: 'Home', page: '001' },
    { label: 'About', page: '002' },
    { label: 'Skills', page: '003' },
    { label: 'Works', page: '004' },
    { label: 'Lab', page: '005' },
    { label: 'Contact', page: '006' }
  ]
  const activeIndex = 0
  const socialList = ['GitHub', 'LinkedIn', 'Dribbble']

  const visible = ref(false) // 實際的 display 狀態（關閉動畫播完才隱藏）

  const underlay = ref<HTMLElement | null>(null)
  const barOuter = ref<HTMLElement | null>(null)
  const barInner = ref<HTMLElement | null>(null)
  const contentOuter = ref<HTMLElement | null>(null)
  const contentInner = ref<HTMLElement | null>(null)
  const closeBtn = ref<HTMLButtonElement | null>(null)

  // v-for 內的元素 / 元件以函式 ref 依索引收集（確保順序與資料一致）
  const navItems: HTMLElement[] = []
  const navLabels: HackyTextExpose[] = []
  const navExtras: HackyTextExpose[] = []
  const subRows: HTMLElement[] = [] // 選單下方的社群 / 履歷 / 版權列
  const subTexts: HackyTextExpose[] = []

  const OPEN_AT = 0.27 // 主面板開始展開的時間點（窄欄先擦入）
  const ITEM_STAGGER = 0.045 // 選單項目錯開的間隔

  let tl: gsap.core.Timeline | null = null
  let lastFocus: HTMLElement | null = null

  // 開啟動畫（關閉時以 reverse 倒播）。版面鏡像自 kprverse：選單由右側展開，
  // 窄欄（關閉鈕）固定在最右側、疊在 Panel 漢堡按鈕那一欄上，主面板由窄欄往左展開
  const buildTimeline = () => {
    tl = gsap.timeline({
      paused: true,
      onReverseComplete: () => {
        visible.value = false
        ;[...navLabels, ...navExtras, ...subTexts].forEach((t) => t.hide())
      }
    })

    tl
      // 白色遮罩淡入
      .fromTo(underlay.value, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0)
      // 窄欄：外層 / 內層反向位移形成遮罩，由右往左擦入（內容本身不動）
      .fromTo(barOuter.value, { xPercent: 100 }, { xPercent: 0, duration: OPEN_AT, ease: 'power2.in' }, 0)
      .fromTo(barInner.value, { xPercent: -100 }, { xPercent: 0, duration: OPEN_AT, ease: 'power2.in' }, 0)
      // 主面板：同樣以雙層遮罩由右往左展開
      .fromTo(contentOuter.value, { xPercent: 100 }, { xPercent: 0, duration: 0.45, ease: 'power3.out' }, OPEN_AT)
      .fromTo(contentInner.value, { xPercent: -100 }, { xPercent: 0, duration: 0.45, ease: 'power3.out' }, OPEN_AT)
      // 選單項目：依序由右側滑入
      .fromTo(
        navItems,
        { x: 160, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: ITEM_STAGGER },
        OPEN_AT
      )
      // 下方資訊列淡入
      .fromTo(subRows, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.06 }, OPEN_AT + 0.2)
  }

  // 文字逐字解碼：時間點對齊 timeline 中各項目的進場
  const playTexts = () => {
    navLabels.forEach((t, i) => t.play((OPEN_AT + i * ITEM_STAGGER) * 1000))
    navExtras[activeIndex]?.play((OPEN_AT + activeIndex * ITEM_STAGGER) * 1000 + 200)
    subTexts.forEach((t, i) => t.play((OPEN_AT + 0.2) * 1000 + i * 40))
  }

  const show = async () => {
    lastFocus = document.activeElement as HTMLElement | null
    visible.value = true
    await nextTick()
    if (!tl) return

    // 關閉途中再開啟時，play() 會從目前進度接續正播
    playTexts()

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) tl.progress(1)
    else tl.timeScale(1).play()

    closeBtn.value?.focus({ preventScroll: true })
  }

  const hide = () => {
    if (!tl) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tl.progress(0)
      tl.eventCallback('onReverseComplete')?.()
    } else {
      tl.timeScale(1.5).reverse() // 關閉時加速倒播
    }
    lastFocus?.focus({ preventScroll: true })
  }

  const close = () => (open.value = false)

  watch(open, (value) => (value ? show() : hide()))

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open.value) close()
  }

  // hover 時重播該項目的解碼（含右上角的頁碼）
  const onNavEnter = (i: number) => {
    navLabels[i]?.play()
    navExtras[i]?.play(60)
  }

  onMounted(() => {
    buildTimeline()
    window.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    tl?.kill()
    window.removeEventListener('keydown', onKeydown)
  })
</script>

<template>
  <Teleport to="#teleports">
    <!-- 開啟時攔截滾輪 / 觸控滑動，避免背後的 ScrollTrigger 頁面跟著捲動 -->
    <div
      v-show="visible"
      class="side-menu fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="網站選單"
      @wheel.prevent
      @touchmove.prevent
    >
      <!-- 白色漸層遮罩：點擊關閉 -->
      <div ref="underlay" class="absolute inset-0" @click="close">
        <div class="underlay-graphic absolute inset-0"></div>
      </div>

      <!-- 外框對齊 Panel（行動版距邊 12px、桌機 24px），由右側展開 -->
      <div class="absolute top-3 right-3 bottom-3 md:top-6 md:right-6 md:bottom-6 flex text-white uppercase">
        <!-- 主面板 -->
        <div class="relative h-full w-[calc(100vw-24px-44px)] md:w-115 lg:w-135 overflow-hidden">
          <div ref="contentOuter" class="absolute inset-0 overflow-hidden">
            <div ref="contentInner" class="absolute inset-0 flex flex-col bg-black rounded-l-lg md:rounded-l-xl">
              <!-- 選單 -->
              <div class="section flex-1 min-h-0 pt-6 md:pt-9">
                <div class="section-left">
                  <span class="dot-caption"><i></i>Discover</span>
                </div>
                <nav class="flex-1 flex flex-col items-start">
                  <a
                    v-for="(item, i) in navList"
                    :key="item.label"
                    :ref="(el) => (navItems[i] = el as HTMLElement)"
                    href="#"
                    class="menu-item"
                    :class="{ 'is-active': i === activeIndex }"
                    :aria-current="i === activeIndex ? 'page' : undefined"
                    @mouseenter="onNavEnter(i)"
                    @click.prevent="close"
                  >
                    <span class="menu-item-bg clip-br-bevel"></span>
                    <AtomsHackyText
                      :ref="(el) => (navLabels[i] = el as unknown as HackyTextExpose)"
                      :text="item.label"
                      hidden
                      class="menu-item-label"
                    />
                    <AtomsHackyText
                      :ref="(el) => (navExtras[i] = el as unknown as HackyTextExpose)"
                      :text="`Page\n${item.page}`"
                      hidden
                      class="menu-item-extra"
                    />
                  </a>
                </nav>
              </div>

              <!-- 社群連結 -->
              <div :ref="(el) => (subRows[0] = el as HTMLElement)" class="section">
                <div class="section-left">
                  <span class="dot-caption"><i></i>Connect</span>
                </div>
                <div class="flex flex-col items-start gap-2">
                  <a
                    v-for="(label, i) in socialList"
                    :key="label"
                    href="#"
                    class="link-hover"
                    @mouseenter="subTexts[i]?.play()"
                    @click.prevent
                  >
                    <AtomsHackyText
                      :ref="(el) => (subTexts[i] = el as unknown as HackyTextExpose)"
                      :text="label"
                      hidden
                    />
                  </a>
                </div>
              </div>

              <!-- 履歷下載 -->
              <div :ref="(el) => (subRows[1] = el as HTMLElement)" class="section items-center">
                <div class="section-left">
                  <span class="dot-caption"><i></i>Resume</span>
                </div>
                <a
                  href="#"
                  class="link-hover inline-flex items-center gap-2"
                  @mouseenter="subTexts[socialList.length]?.play()"
                  @click.prevent
                >
                  <svg viewBox="0 0 12 12" class="w-2.5 h-2.5" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M6 1v8M2.5 5.5L6 9l3.5-3.5M1 11h10" stroke-width="1.2" />
                  </svg>
                  <AtomsHackyText
                    :ref="(el) => (subTexts[socialList.length] = el as unknown as HackyTextExpose)"
                    text="Download CV"
                    hidden
                  />
                </a>
              </div>

              <!-- 語系 / 版權 -->
              <div
                :ref="(el) => (subRows[2] = el as HTMLElement)"
                class="section items-center h-11 md:h-12 py-0! text-[10px]"
              >
                <div class="section-left">
                  <span>ZH-TW ⌄</span>
                </div>
                <span class="opacity-40">© 2026 Syun</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 窄欄（最右側）：關閉鈕 / 標誌 / 裝飾等化器（寬度對齊 Panel 右側欄） -->
        <div class="relative h-full w-11 md:w-14 shrink-0">
          <div ref="barOuter" class="absolute inset-0 overflow-hidden">
            <div
              ref="barInner"
              class="absolute inset-0 flex flex-col items-center justify-center bg-black rounded-r-lg md:rounded-r-xl"
            >
              <span class="absolute inset-y-0 left-0 w-px bg-white/20"></span>
              <button
                ref="closeBtn"
                type="button"
                class="btn-close absolute inset-x-0 top-0 h-10 grid place-items-center border-b border-white/20"
                aria-label="關閉選單"
                @click="close"
              >
                <svg viewBox="0 0 12 12" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="1.2">
                  <path class="stroke-a" d="M1 1l10 10" />
                  <path class="stroke-b" d="M11 1L1 11" />
                </svg>
              </button>
              <span class="text-[11px] leading-5 md:leading-8 md:text-xs font-normal [writing-mode:vertical-rl]"
                >Side Project by Syun</span
              >
              <!-- 底部：裝飾用等化器 -->
              <div class="absolute inset-x-0 bottom-0 aspect-square grid place-items-center" aria-hidden="true">
                <span class="eq flex items-center gap-0.5 h-3">
                  <i v-for="n in 4" :key="n" :style="`--n: ${n}`"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
  .side-menu {
    --menu-accent: #c0fb50; /* 目前頁面的高亮色 */
  }

  /* 由選單側（右）往左漸淡的白色遮罩 */
  .underlay-graphic {
    background: linear-gradient(270deg, #fff 28%, rgb(255 255 255 / 0.75));
    opacity: 0.85;
  }

  .section {
    display: flex;
    align-items: stretch;
    padding: 16px;
    border-bottom: 1px solid rgb(255 255 255 / 0.2);

    &:last-child {
      border-bottom: 0;
    }

    @media (min-width: 768px) {
      padding: 24px;
    }
  }

  .section-left {
    width: 72px;
    flex-shrink: 0;
    font-size: 10px;

    @media (min-width: 768px) {
      width: 112px;
    }
  }

  /* 小方點 + 標題 */
  .dot-caption {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.05em;

    i {
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  /* 選單項目：hover 時切角白底 + 黑字，目前頁面為螢光綠底 */
  .menu-item {
    position: relative;
    display: inline-block;
    padding: 2px 20px 2px 6px;
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }

    @media (min-width: 768px) {
      padding: 4px 24px 4px 8px;
    }
  }

  .menu-item-bg {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateY(-2px);
    background: #fff;
  }

  .menu-item-label {
    position: relative;
    display: block;
    font-weight: 700;
    /* 依視窗高度縮放，矮螢幕也放得下全部項目 */
    font-size: clamp(30px, 6.4dvh, 40px);
    line-height: 0.95;
    letter-spacing: -0.04em;
    white-space: nowrap;

    @media (min-width: 768px) {
      font-size: clamp(34px, 7.2dvh, 58px);
    }
  }

  /* 右上角頁碼：只在 hover / 目前頁面顯示 */
  .menu-item-extra {
    position: absolute;
    top: 0;
    left: 100%;
    margin-left: 8px;
    font-size: 9px;
    line-height: 1.2;
    white-space: pre-line;
    opacity: 0;
  }

  .menu-item:hover,
  .menu-item:focus-visible {
    outline: none;

    .menu-item-bg {
      opacity: 1;
    }
    .menu-item-label {
      color: #000;
    }
    .menu-item-extra {
      opacity: 1;
    }
  }

  .menu-item.is-active {
    pointer-events: none;

    .menu-item-bg {
      opacity: 1;
      background: var(--menu-accent);
    }
    .menu-item-label {
      color: #000;
    }
    .menu-item-extra {
      opacity: 1;
      color: var(--menu-accent);
    }
  }

  /* 小連結：hover 時白底由左往右刷入、文字反黑 */
  .link-hover {
    position: relative;
    font-size: 11px;
    line-height: 1.4;
    padding: 0 2px;
    letter-spacing: 0.04em;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: #fff;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s cubic-bezier(0.7, 0, 0.3, 1);
    }

    > * {
      position: relative;
    }

    &:hover,
    &:focus-visible {
      outline: none;
      color: #000;

      &::before {
        transform: scaleX(1);
      }
    }
  }

  /* 關閉鈕：hover 時 X 旋轉 */
  .btn-close svg {
    transition: transform 0.4s cubic-bezier(0.7, 0, 0.3, 1);
  }
  .btn-close:hover svg,
  .btn-close:focus-visible svg {
    transform: rotate(90deg);
  }
  .btn-close:focus-visible {
    outline: 1px solid #fff;
    outline-offset: -4px;
  }

  /* 裝飾等化器：四條細線上下跳動 */
  .eq i {
    width: 1px;
    height: 100%;
    background: currentColor;
    animation: eq 0.9s ease-in-out infinite alternate;
    animation-delay: calc(var(--n) * -0.23s);
  }

  @keyframes eq {
    from {
      transform: scaleY(0.3);
    }
    to {
      transform: scaleY(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .eq i {
      animation: none;
    }
  }
</style>
