<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'

  /**
   * AppCursor：全站自訂游標（參考 kprverse 首頁 tableau 段落的游標：圓環＋左右內指三角＋十字準星＋下方小字）。
   *   - 一般：細圓環（外側四個刻度）＋中心方點；圓環右下方兩行小灰字：即時座標（移動時數字跳動）、
   *     系統狀態字（每隔幾秒以逐字解碼換一句，同 Contact 區 Console 的小灰字）
   *   - hover（連結、按鈕、可點的卡片）：圓環放大並斷成兩段弧緩慢旋轉、左右出現內指三角、方點變成十字準星；
   *     下方浮現白色主文字（OPEN ↗ / VIEW / CLICK，可用 data-cursor="文字" 自訂、data-cursor="" 不顯示），
   *     灰字改成目標資訊（例如 LINK → /gallery）
   *   - 按下：圓環收縮、灰字顯示 EXECUTE，放開時一圈波紋往外擴散淡出
   *   - 進度模式（useCursorMode().set('progress', …)，例如 Gallery 首屏的卡片輪盤）：
   *     圓環變成圓形進度條（淡色軌道＋從頂端順時針增長的亮弧，弧的前端有一個小點，外圈刻度隨進度旋轉），
   *     中心顯示目前編號、下方顯示 SCROLL、灰字第二行顯示進度資訊；hover 卡片時仍顯示 VIEW 等主文字
   * 白色線條＋淡淡的深色光暈：深色底、照片（中間調）與白色底上都清楚（反色混合在中間調照片上會變灰、不夠顯眼）。
   * 只在有滑鼠的裝置啟用（pointer: fine 且可 hover）；文字輸入框保留原生的 I 形游標。
   */

  type HackyTextExpose = { play: (delay?: number) => void; hide: () => void }

  const enabled = ref(false)
  const state = ref<'idle' | 'hover' | 'text' | 'hidden'>('hidden')
  const pressed = ref(false)
  const label = ref('') // 圓環下方的白色主文字（hover 或進度模式時顯示）
  const hoverLabel = ref('') // hover 目標對應的主文字
  const status = ref('Tracking') // 灰字第二行
  const labelText = ref<HackyTextExpose | null>(null)
  const statusText = ref<HackyTextExpose | null>(null)

  const dot = ref<HTMLElement | null>(null)
  const ring = ref<HTMLElement | null>(null)
  const coords = ref<HTMLElement | null>(null)
  const ripple = ref<HTMLElement | null>(null)

  const INTERACTIVE = 'a[href], button, [role="button"], label[for], select, summary, [data-cursor]'
  const TEXT_FIELD =
    'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]'

  // 一般狀態輪播的狀態字
  const IDLE_STATUS = ['Tracking', 'Signal OK', 'Idle · 60 FPS', 'Scanning', 'Syun.sys']

  // 模式（各頁透過 useCursorMode 切換）
  const { mode, onProgress } = useCursorMode()
  const isProgress = computed(() => mode.value.name === 'progress')

  // 進度條：直接改 DOM（不經 Vue 響應式，避免每幀重新渲染），並以 quickTo 平滑
  const progressArc = ref<SVGCircleElement | null>(null)
  const progressHead = ref<SVGGElement | null>(null)
  const ticks = ref<SVGGElement | null>(null)
  const progressState = { value: 0 }
  const applyProgress = () => {
    const p = progressState.value
    progressArc.value?.style.setProperty('stroke-dashoffset', String(100 - p * 100))
    const rotate = `rotate(${p * 360}deg)`
    if (progressHead.value) progressHead.value.style.transform = rotate
    if (ticks.value) ticks.value.style.transform = isProgress.value ? rotate : ''
  }
  let progressTo: gsap.QuickToFunc | null = null
  watch(isProgress, applyProgress)

  const labelFor = (el: Element) => {
    const custom = el.getAttribute('data-cursor')
    if (custom !== null) return custom
    if (el.tagName === 'A') return el.getAttribute('target') === '_blank' ? 'Open ↗' : 'View'
    return 'Click'
  }

  // 灰字：目標資訊（連結顯示路徑或網域、按鈕顯示文字）
  const describe = (el: Element) => {
    const clip = (text: string) => (text.length > 18 ? `${text.slice(0, 17)}…` : text)
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') ?? ''
      try {
        const url = new URL(href, location.href)
        return `Link → ${clip(url.origin === location.origin ? url.pathname + url.hash : url.hostname)}`
      } catch {
        return 'Link'
      }
    }
    // 逐段讀取文字節點並以空格連接（避免 <span>02</span>Motion 黏成 02Motion）
    const parts: string[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '')
    const text = (el.getAttribute('aria-label') || parts.join(' ')).replace(/\s+/g, ' ').trim()
    return text ? `${el.tagName === 'BUTTON' ? 'Btn' : 'Ui'} · ${clip(text)}` : 'Interactive'
  }

  const setStatus = async (text: string) => {
    if (status.value === text) return
    status.value = text
    await nextTick()
    statusText.value?.play()
  }

  // 灰字第二行：按下 → EXECUTE；進度模式 → 進度資訊；hover → 目標資訊；其餘 → 輪播的狀態字
  const refreshStatus = () => {
    if (pressed.value) return setStatus('Execute')
    if (isProgress.value && mode.value.meta) return setStatus(mode.value.meta)
    if (state.value === 'hover' && current) return setStatus(describe(current))
    if (state.value === 'idle' && current) return setStatus('Disabled')
    setStatus(IDLE_STATUS[idleIndex]!)
  }

  // 主文字：hover 時為目標的文字；進度模式下沒有 hover 時為模式的文字（例如 SCROLL）
  const displayLabel = computed(() =>
    state.value === 'hover' ? hoverLabel.value : isProgress.value ? mode.value.label : ''
  )
  watch(displayLabel, async (text) => {
    if (!text) return
    label.value = text
    await nextTick()
    labelText.value?.play()
  })
  watch(
    () => [mode.value.name, mode.value.meta],
    () => refreshStatus()
  )

  let moveDot: ((x: number, y: number) => void) | null = null
  let ringX: gsap.QuickToFunc | null = null
  let ringY: gsap.QuickToFunc | null = null
  let current: Element | null = null
  let idleIndex = 0

  const setTarget = async (el: Element | null) => {
    if (el === current) return
    current = el
    if (!el) {
      state.value = 'idle'
      refreshStatus()
      return
    }
    if (el.matches(TEXT_FIELD)) {
      state.value = 'text'
      return
    }
    const disabled = (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true'
    if (disabled) {
      state.value = 'idle'
      refreshStatus()
      return
    }
    hoverLabel.value = labelFor(el)
    state.value = 'hover'
    refreshStatus()
  }

  // 座標小字：直接改文字（不經 Vue 響應式），每次移動都更新，數字跳動
  const pad4 = (n: number) => String(Math.max(0, Math.round(n))).padStart(4, '0')
  let coordsFrame = 0
  let pointerX = 0
  let pointerY = 0
  const writeCoords = () => {
    coordsFrame = 0
    if (coords.value) coords.value.textContent = `X ${pad4(pointerX)} · Y ${pad4(pointerY)}`
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    moveDot?.(e.clientX, e.clientY)
    ringX?.(e.clientX)
    ringY?.(e.clientY)
    pointerX = e.clientX
    pointerY = e.clientY
    // 座標文字每幀最多更新一次（pointermove 可能比畫面更新還頻繁）
    if (!coordsFrame) coordsFrame = requestAnimationFrame(writeCoords)
    if (state.value === 'hidden') state.value = 'idle'
  }

  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const target = e.target as Element | null
    setTarget(target?.closest?.(TEXT_FIELD) ?? target?.closest?.(INTERACTIVE) ?? null)
  }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    pressed.value = true
    refreshStatus()
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    if (pressed.value && ripple.value && ring.value) {
      gsap.set(ripple.value, { x: gsap.getProperty(ring.value, 'x'), y: gsap.getProperty(ring.value, 'y') })
      gsap.fromTo(ripple.value, { scale: 0.5, autoAlpha: 0.9 }, { scale: 1.8, autoAlpha: 0, duration: 0.6, ease: 'power2.out' })
    }
    pressed.value = false
    refreshStatus()
  }

  const onLeave = () => {
    state.value = 'hidden'
    current = null
  }

  // 元素在游標底下消失或換頁時（不會觸發 pointerover），重新檢查一次游標底下的元素
  let unregisterProgress: (() => void) | null = null
  let recheckTimer: ReturnType<typeof setInterval> | undefined
  let idleTimer: ReturnType<typeof setInterval> | undefined
  let lastX = -1
  let lastY = -1
  const recheck = () => {
    if (!dot.value || state.value === 'hidden') return
    const x = gsap.getProperty(dot.value, 'x') as number
    const y = gsap.getProperty(dot.value, 'y') as number
    if (x === lastX && y === lastY && (!current || current.isConnected)) return
    lastX = x
    lastY = y
    const under = document.elementFromPoint(x, y)
    setTarget(under?.closest(TEXT_FIELD) ?? under?.closest(INTERACTIVE) ?? null)
  }

  // 一般狀態：每隔幾秒換一句狀態字（逐字解碼）
  const rotateIdle = () => {
    if (state.value !== 'idle' || pressed.value || isProgress.value || current) return
    idleIndex = (idleIndex + 1) % IDLE_STATUS.length
    setStatus(IDLE_STATUS[idleIndex]!)
  }

  onMounted(async () => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!fine) return
    enabled.value = true
    await nextTick()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.documentElement.classList.add('has-custom-cursor')
    const setX = gsap.quickSetter(dot.value, 'x', 'px') as (v: number) => void
    const setY = gsap.quickSetter(dot.value, 'y', 'px') as (v: number) => void
    moveDot = (x, y) => {
      setX(x)
      setY(y)
    }
    ringX = gsap.quickTo(ring.value, 'x', { duration: reduce ? 0 : 0.32, ease: 'power3.out' })
    ringY = gsap.quickTo(ring.value, 'y', { duration: reduce ? 0 : 0.32, ease: 'power3.out' })
    progressTo = gsap.quickTo(progressState, 'value', {
      duration: reduce ? 0 : 0.3,
      ease: 'power2.out',
      onUpdate: applyProgress
    })
    unregisterProgress = onProgress((p) => progressTo?.(gsap.utils.clamp(0, 1, p)))
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    recheckTimer = setInterval(recheck, 250)
    idleTimer = setInterval(rotateIdle, 2600)
    statusText.value?.play()
  })

  onBeforeUnmount(() => {
    document.documentElement.classList.remove('has-custom-cursor')
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerover', onOver)
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', onUp)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('blur', onLeave)
    clearInterval(recheckTimer)
    clearInterval(idleTimer)
    cancelAnimationFrame(coordsFrame)
    unregisterProgress?.()
  })
</script>

<template>
  <div
    v-if="enabled"
    class="app-cursor"
    :class="[`is-${state}`, { 'is-pressed': pressed, 'is-progress': isProgress }]"
    aria-hidden="true"
  >
    <!-- 圓環（平滑跟隨）：外圈刻度＋左右內指三角＋小灰字＋下方主文字 -->
    <div ref="ring" class="cursor-ring">
      <svg class="ring-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle class="ring-circle" cx="50" cy="50" r="46" pathLength="100" vector-effect="non-scaling-stroke" />
        <!-- 進度模式：淡色軌道＋進度弧（從頂端順時針）＋弧前端的小點 -->
        <circle class="ring-track" cx="50" cy="50" r="46" vector-effect="non-scaling-stroke" />
        <circle
          ref="progressArc"
          class="ring-progress"
          cx="50"
          cy="50"
          r="46"
          pathLength="100"
          vector-effect="non-scaling-stroke"
        />
        <g ref="progressHead" class="ring-head">
          <circle cx="50" cy="4" r="3.2" fill="currentColor" stroke="none" />
        </g>
        <g ref="ticks" class="ring-ticks" vector-effect="non-scaling-stroke">
          <line x1="50" y1="-6" x2="50" y2="2" />
          <line x1="98" y1="50" x2="106" y2="50" />
          <line x1="50" y1="98" x2="50" y2="106" />
          <line x1="-6" y1="50" x2="2" y2="50" />
        </g>
      </svg>
      <i class="arrow left"></i>
      <i class="arrow right"></i>

      <!-- 小灰字：座標（即時跳動）＋狀態字（逐字解碼） -->
      <span class="cursor-meta">
        <span ref="coords" class="meta-line tabular-nums">X 0000 · Y 0000</span>
        <span class="meta-line"><AtomsHackyText ref="statusText" :text="status" :speed="2.2" /></span>
      </span>

      <!-- hover 時的主文字 -->
      <span class="cursor-label">
        <AtomsHackyText v-if="label" ref="labelText" :text="label" :speed="2" hidden />
      </span>
    </div>

    <!-- 中心（即時跟隨）：方點 / hover 時的十字準星 -->
    <div ref="dot" class="cursor-dot">
      <i class="dot"></i>
      <span class="dot-index tabular-nums">{{ mode.index }}</span>
      <i class="cross h"></i>
      <i class="cross v"></i>
    </div>

    <!-- 點擊波紋 -->
    <span ref="ripple" class="cursor-ripple"></span>
  </div>
</template>

<style lang="scss">
  /* 啟用自訂游標時隱藏系統游標；文字輸入框保留 I 形游標 */
  html.has-custom-cursor,
  html.has-custom-cursor * {
    cursor: none !important;
  }

  html.has-custom-cursor
    :is(
      input:not([type='button'], [type='submit'], [type='checkbox'], [type='radio'], [type='range']),
      textarea,
      [contenteditable='true']
    ) {
    cursor: text !important;
  }
</style>

<style lang="scss" scoped>
  /* 容器本身是 0×0（不佔滿全螢幕）：重繪範圍只有游標附近的小圖層 */
  .app-cursor {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 200;
    width: 0;
    height: 0;
    pointer-events: none;
    color: #fff;
    transition: opacity 0.25s;

    &.is-hidden,
    &.is-text {
      opacity: 0;
    }
  }

  .cursor-ring,
  .cursor-dot,
  .cursor-ripple {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }

  /* 深色光暈（讓白色游標在照片與白底上也清楚）：只套在小小的圓環與中心點上，移動時由合成器直接位移、不必重算濾鏡 */
  .cursor-ring,
  .cursor-dot {
    filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.55)) drop-shadow(0 1px 3px rgb(0 0 0 / 0.35));
  }

  /* ── 圓環 ── */
  .cursor-ring {
    --size: 44px;
  }

  .ring-svg {
    position: absolute;
    width: var(--size);
    height: var(--size);
    overflow: visible;
    translate: -50% -50%;
    transition:
      width 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* 圓：一般為完整一圈；hover 時斷成兩段弧（pathLength = 100：每段弧 38、缺口 12）並旋轉 */
  .ring-circle {
    stroke-width: 1.4;
    stroke-dasharray: 100 0;
    transform-origin: 50px 50px;
    transition: stroke-dasharray 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .ring-ticks {
    stroke-width: 1.2;
    opacity: 0.7;
    transition: opacity 0.3s;
  }

  /* 左右內指三角（同參考網站）：hover 時才出現 */
  .arrow {
    position: absolute;
    top: 0;
    width: 0;
    height: 0;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    opacity: 0;
    translate: 0 -50%;
    transition:
      opacity 0.25s,
      left 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      right 0.4s cubic-bezier(0.22, 1, 0.36, 1);

    &.left {
      left: calc(var(--size) / -2 + 6px);
      border-left: 6px solid currentColor;
    }

    &.right {
      right: calc(var(--size) / -2 + 6px);
      border-right: 6px solid currentColor;
    }
  }

  /* 小灰字：圓環右下方 */
  .cursor-meta {
    position: absolute;
    top: calc(var(--size) / 2 - 6px);
    left: calc(var(--size) / 2 + 8px);
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 9px;
    line-height: 1.35;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0.72;
    transition:
      top 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      left 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* hover 主文字：圓環正下方 */
  .cursor-label {
    position: absolute;
    top: calc(var(--size) / 2 + 10px);
    left: 0;
    translate: -50% 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
    opacity: 0;
    transition:
      opacity 0.2s,
      top 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* ── 中心：方點／十字準星 ── */
  .dot {
    position: absolute;
    width: 5px;
    height: 5px;
    background: currentColor;
    translate: -50% -50%;
    transition: scale 0.25s;
  }

  .cross {
    position: absolute;
    background: currentColor;
    translate: -50% -50%;
    scale: 0;
    transition: scale 0.3s cubic-bezier(0.22, 1, 0.36, 1);

    &.h {
      width: 16px;
      height: 1px;
    }

    &.v {
      width: 1px;
      height: 16px;
    }
  }

  .cursor-ripple {
    width: 60px;
    height: 60px;
    margin: -30px 0 0 -30px;
    border: 1px solid currentColor;
    border-radius: 50%;
    opacity: 0;
    visibility: hidden;
  }

  /* ── 進度模式的元素（預設隱藏） ── */
  .ring-track,
  .ring-progress,
  .ring-head {
    opacity: 0;
    transition: opacity 0.3s;
  }

  .ring-track {
    stroke-width: 1.4;
  }

  /* 進度弧：從 12 點鐘方向開始（circle 預設從 3 點鐘開始，轉 -90°） */
  .ring-progress {
    stroke-width: 2.4;
    stroke-dasharray: 100 100;
    stroke-dashoffset: 100;
    transform: rotate(-90deg);
    transform-origin: 50px 50px;
  }

  /* 進度的旋轉 / 弧長由 JS 每幀直接寫入（已用 quickTo 平滑），不加 CSS 過渡，避免每幀重新觸發過渡 */
  .ring-head,
  .ring-ticks {
    transform-origin: 50px 50px;
  }

  .dot-index {
    position: absolute;
    translate: -50% -50%;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    opacity: 0;
    transition: opacity 0.25s;
  }

  /* ── hover ── */
  .is-hover {
    .cursor-ring {
      --size: 70px;
    }

    .ring-circle {
      stroke-dasharray: 38 12;
      animation: ring-spin 6s linear infinite;
    }

    .ring-ticks {
      opacity: 0;
    }

    .arrow {
      opacity: 1;
    }

    .cursor-label {
      opacity: 1;
    }

    .dot {
      scale: 0;
    }

    .cross {
      scale: 1;
    }
  }

  /* ── 進度模式：圓環換成進度條、中心顯示編號、下方顯示主文字 ── */
  .is-progress {
    .cursor-ring {
      --size: 66px;
    }

    &.is-hover .cursor-ring {
      --size: 74px;
    }

    .ring-circle {
      opacity: 0;
      animation: none;
    }

    .ring-track {
      opacity: 0.3;
    }

    .ring-progress,
    .ring-head {
      opacity: 1;
    }

    .ring-ticks {
      opacity: 0.7;
    }

    .cursor-label {
      opacity: 1;
    }

    .dot,
    .cross {
      scale: 0;
    }

    .dot-index {
      opacity: 1;
    }
  }

  @keyframes ring-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── 按下：圓環收縮 ── */
  .is-pressed {
    .cursor-ring {
      --size: 30px;
    }

    &.is-hover .cursor-ring {
      --size: 52px;
    }

    .dot {
      scale: 1.6;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring-svg,
    .ring-circle,
    .arrow,
    .cursor-meta,
    .cursor-label,
    .dot,
    .cross {
      transition: none;
    }

    .is-hover .ring-circle {
      animation: none;
    }
  }
</style>
