<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { CAREER_LINKS, SOCIAL_LINKS } from '#shared/profile'
  import { NAV_PAGES } from '#shared/site'

  type HackyTextExpose = { play: (delay?: number) => void; hide: () => void }

  // 側選單開關（由 Panel 的漢堡按鈕以 v-model:open 控制）
  const open = defineModel<boolean>('open', { default: false })

  // 分頁選單：to 為路由（to 為 null 的分頁先不可點）；目前頁面依路由高亮
  const navList = NAV_PAGES
  const route = useRoute()
  const activeIndex = computed(() =>
    Math.max(
      0,
      // 子頁面（例如 /articles/xxx）也標示所屬的分頁
      navList.findIndex((item) => item.to === route.path || (item.to && item.to !== '/' && route.path.startsWith(`${item.to}/`)))
    )
  )

  // 點選其他分頁：直接換頁，由換頁轉場（PageTransition）的方塊蓋過整個畫面（含選單）；
  // 新頁面的選單本來就是關閉狀態，不必先播關閉動畫。點選目前頁面則只關閉選單
  const onNavClick = (i: number) => {
    const to = navList[i]?.to
    if (to && to !== route.path) navigateTo(to)
    else close()
  }
  // Connect 區塊的連結：取自 Footer 共用的連結資料（shared/profile.ts），依此順序排列
  const SOCIAL_ORDER = ['GitHub', 'LinkedIn', 'Instagram', 'Facebook', 'LINE']
  const socialList = SOCIAL_ORDER.map((label) => [...CAREER_LINKS, ...SOCIAL_LINKS].find((l) => l.label === label)!)

  // 窄欄底部點陣的亮起順序：沿外圈順時針（左上 → 右上 → 右下 → 左下）走一圈，最後亮中心。
  // 依格子索引換算每格的動畫延遲（每步 0.2s，九步剛好一個 1.8s 循環）
  const DOT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3, 4]
  const DOT_DELAYS = Array.from({ length: 9 }, (_, i) => DOT_ORDER.indexOf(i) * 0.2)

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
    navExtras[activeIndex.value]?.play((OPEN_AT + activeIndex.value * ITEM_STAGGER) * 1000 + 200)
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
      <div ref="underlay" class="underlay absolute inset-0" @click="close">
        <div class="underlay-graphic absolute inset-0"></div>
      </div>

      <!-- 外框對齊 Panel（行動版距邊 12px、桌機 24px），由右側展開 -->
      <div class="absolute top-3 right-3 bottom-3 md:top-6 md:right-6 md:bottom-6 flex text-white">
        <!-- 主面板 -->
        <div class="relative h-full w-[calc(100vw-24px-44px)] md:w-115 lg:w-135 overflow-hidden">
          <div ref="contentOuter" class="absolute inset-0 overflow-hidden">
            <div ref="contentInner" class="glass absolute inset-0 flex flex-col rounded-l-lg md:rounded-l-xl">
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
                    :href="item.to ?? '#'"
                    class="menu-item"
                    :class="{ 'is-active': i === activeIndex, 'is-disabled': !item.to }"
                    :aria-current="i === activeIndex ? 'page' : undefined"
                    :aria-disabled="!item.to || undefined"
                    @mouseenter="onNavEnter(i)"
                    @click.prevent="onNavClick(i)"
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
                    v-for="(link, i) in socialList"
                    :key="link.label"
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link-hover"
                    @mouseenter="subTexts[i]?.play()"
                  >
                    <AtomsHackyText
                      :ref="(el) => (subTexts[i] = el as unknown as HackyTextExpose)"
                      :text="link.label"
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

        <!-- 窄欄（最右側）：關閉鈕 / 標誌 / 裝飾點陣（寬度對齊 Panel 右側欄） -->
        <div class="relative h-full w-11 md:w-14 shrink-0">
          <div ref="barOuter" class="absolute inset-0 overflow-hidden">
            <div
              ref="barInner"
              class="glass absolute inset-0 flex flex-col items-center justify-center rounded-r-lg md:rounded-r-xl"
            >
              <span class="absolute inset-y-0 left-0 w-px bg-white/15"></span>
              <button
                ref="closeBtn"
                type="button"
                class="btn-close absolute inset-x-0 top-0 h-10 grid place-items-center border-b border-white/15"
                aria-label="關閉選單"
                @click="close"
              >
                <svg viewBox="0 0 12 12" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="1.2">
                  <path class="stroke-a" d="M1 1l10 10" />
                  <path class="stroke-b" d="M11 1L1 11" />
                </svg>
              </button>
              <span
                class="text-[11px] leading-5 md:leading-8 md:text-xs font-normal [writing-mode:vertical-rl] uppercase"
                >Side Project by Syun</span
              >
              <!-- 底部：裝飾用點陣掃描（九宮格沿外圈順時針依序亮起、最後亮中心） -->
              <div class="absolute inset-x-0 bottom-0 aspect-square grid place-items-center" aria-hidden="true">
                <span class="dot-scan">
                  <i v-for="(delay, i) in DOT_DELAYS" :key="i" :style="{ animationDelay: `${delay}s` }"></i>
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
    /* 目前頁面的高亮色：取自主視覺圖的鈷藍（#274796）提亮一階，在暗色玻璃上才夠顯眼 */
    --menu-accent: #3d6af2;
    --menu-accent-fg: #fff; /* 高亮底上的文字色 */
    --menu-accent-soft: #9db6ff; /* 頁碼等小字（淺藍，在暗底上維持可讀） */
  }

  /* 背景遮罩：輕微壓暗 + 微模糊（讓頁面略為失焦，但仍透得出來，毛玻璃面板才有東西可以霧化）。
     backdrop-filter 放在 gsap 補間透明度的這一層本身：若放在子層，父層透明度 < 1 時會截斷背景取樣，淡入結束時模糊才突然出現 */
  .underlay {
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  .underlay-graphic {
    background: linear-gradient(270deg, rgb(0 0 0 / 0.5) 20%, rgb(0 0 0 / 0.18));
  }

  /* 毛玻璃面板（主面板與窄欄共用）：半透明深色底 + 強模糊與飽和度提升，
     疊一層斜向光澤，並以內陰影畫出細高光描邊（上緣較亮，模擬玻璃邊緣的反光） */
  .glass {
    background:
      linear-gradient(135deg, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0.03) 40%, rgb(255 255 255 / 0.07)),
      rgb(18 18 22 / 0.45);
    backdrop-filter: blur(28px) saturate(170%);
    -webkit-backdrop-filter: blur(28px) saturate(170%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 0.12),
      inset 0 1px 0 rgb(255 255 255 / 0.28);
  }

  /* 不支援 backdrop-filter 的瀏覽器：退回接近不透明的深色底，確保文字可讀 */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .glass {
      background: rgb(17 17 17 / 0.94);
    }
  }

  /* 不在這裡設 align-items：flex 預設即為拉伸（選單區需要），
     且 scoped 樣式權重高於 Tailwind，寫死會蓋掉模板上 items-center 的垂直置中 */
  .section {
    display: flex;
    padding: 16px;
    border-bottom: 1px solid rgb(255 255 255 / 0.14);

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

  /* 尚未製作的分頁：降低透明度提示不可用 */
  /* 透明度設在子層：項目本身的 opacity 由開啟動畫（gsap）控制，設在項目上會被覆蓋 */
  .menu-item.is-disabled {
    cursor: not-allowed;

    .menu-item-label {
      opacity: 0.35;
    }

    &:hover .menu-item-bg {
      opacity: 0;
    }
    &:hover .menu-item-label {
      color: inherit;
    }
  }

  .menu-item.is-active {
    pointer-events: none;

    .menu-item-bg {
      opacity: 1;
      background: var(--menu-accent);
    }
    .menu-item-label {
      color: var(--menu-accent-fg);
    }
    .menu-item-extra {
      opacity: 1;
      color: var(--menu-accent-soft);
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

  /* 裝飾點陣：3×3 方點依序亮起後漸暗（留下拖尾），呼應選單中「• Discover」等小方點標記 */
  .dot-scan {
    display: grid;
    grid-template-columns: repeat(3, 3px);
    gap: 3px;

    i {
      width: 3px;
      height: 3px;
      background: currentColor;
      opacity: 0.15;
      animation: dot-scan 1.8s ease-out infinite;
      animation-fill-mode: backwards;
    }
  }

  @keyframes dot-scan {
    0%,
    8% {
      opacity: 1;
    }
    40%,
    100% {
      opacity: 0.15;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot-scan i {
      animation: none;
      opacity: 0.4;
    }
  }
</style>
