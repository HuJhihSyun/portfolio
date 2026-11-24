<script setup lang="ts">
  import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { Observer } from 'gsap/Observer'
  import type { GalleryItem } from '#shared/gallery'
  import { SOCIAL_LINKS } from '#shared/profile'

  gsap.registerPlugin(Observer)

  /**
   * GalleryPosts：Gallery 頁的 Instagram 貼文輪盤（參考 tatap.jp Service 區塊的摩天輪式輪播，改為本站的 HUD 調性）。
   * 所有卡片疊在同一個位置，各自以遠在下方的圓心旋轉 i × --step 度，排成一段大圓弧；
   * 輪盤的位置（pos，以卡片為單位、可為小數）隨滾輪 / 拖曳連續變化，以補間平滑追上目標，
   * 停止操作後吸附到最近的一張；最接近中央的卡片為目前卡片（恢復尺寸、移除壓暗、內文解碼）。
   * 操作：滾輪 / 觸控滑動 / 拖曳 / 鍵盤左右鍵 / 底部按鈕；點擊兩側卡片會轉到該張，點擊中央卡片開啟原始貼文。
   */

  const props = defineProps<{
    items: GalleryItem[]
    entered: boolean // 開場 loading 結束後才播進場
  }>()

  const emit = defineEmits<{
    progress: [value: number] // 0~1：輪盤在整組中的位置（給外框右側的進度條，隨捲動連續變化）
  }>()

  // 輪盤幾何：圓心在卡片下方約 14 個卡片高的位置（transform-origin 1450% = 卡片頂端往下 14.5 倍高）。
  // 卡片寬高比固定（4:5），間距與半徑都跟卡片高成比例，每格角度（CSS 變數 --step）因此是常數：
  // 桌機 4° → 相鄰卡片中心距 ≈ 14H × sin(4°) ≈ 1.22 倍卡片寬；行動版 3° → 約 0.92 倍，兩側卡片會露出一角。
  // 角度由 CSS 依斷點決定（SSR 與瀏覽器輸出一致），再從 computed style 讀回
  const ORIGIN = '50% 1450%'
  const RADIUS = 14 // 圓心到卡片中心的距離（卡片高的倍數），換算拖曳距離用

  const META = {
    title: 'Moments between the beats.',
    desc: 'Snapshots from daily life — breaking sessions, city walks and the design experiments behind this site.',
    word: 'POSTS',
    source: 'Instagram',
    tag: 'IG'
  }

  // Instagram 帳號：取自側選單 / Footer 共用的連結資料（shared/profile.ts）
  const igUrl = SOCIAL_LINKS.find((link) => link.label === 'Instagram')?.url ?? 'https://www.instagram.com/'
  const PROFILE = { url: igUrl, handle: `@${new URL(igUrl).pathname.replace(/\//g, '')}` }

  // 卡片外框角型：每張卡片隨機組合（同首頁 TechFrame 的圓角 / 斜切 / 缺角語彙），增加豐富性。
  // 以作品 id 當亂數種子：同一張卡片每次載入都長一樣，伺服器（SSR）與瀏覽器算出的結果也一致，不會 hydration 不符。
  // 規則：右上固定為斜切或缺角（招牌角）；其餘各角在範圍內變化，尺寸避開頂部標籤、底部內文與右下的 View 按鈕
  type Corner = {
    type: 'round' | 'bevel' | 'notch' | 'square'
    size?: number | string
    depth?: number
    radius?: number
    orientation?: 'horizontal' | 'vertical'
  }
  type Corners = { topLeft: Corner; topRight: Corner; bottomRight: Corner; bottomLeft: Corner }

  // 字串雜湊（FNV-1a）→ 種子；mulberry32 → 0~1 的可重現亂數
  const hash = (text: string) => {
    let h = 2166136261
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
    return h >>> 0
  }
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const cornersFor = (id: string): Corners => {
    const rand = seeded(hash(id))
    const between = (min: number, max: number) => Math.round(min + rand() * (max - min))
    const pick = <T,>(options: (() => T)[]) => options[Math.floor(rand() * options.length)]!()
    return {
      topLeft: pick<Corner>([
        () => ({ type: 'round', size: between(12, 20) }),
        () => ({ type: 'square' }),
        () => ({ type: 'bevel', size: between(16, 26) })
      ]),
      topRight: pick<Corner>([
        () => ({ type: 'bevel', size: between(26, 40) }),
        () => ({
          type: 'notch',
          size: `${between(22, 34)}%`,
          depth: between(12, 16),
          radius: 8,
          orientation: 'vertical'
        })
      ]),
      bottomRight: pick<Corner>([
        () => ({ type: 'round', size: between(12, 20) }),
        () => ({ type: 'square' }),
        () => ({ type: 'bevel', size: between(12, 18) })
      ]),
      bottomLeft: pick<Corner>([
        () => ({ type: 'notch', size: between(56, 90), depth: between(16, 22), radius: between(6, 10) }),
        () => ({ type: 'bevel', size: between(22, 34) }),
        () => ({ type: 'round', size: between(14, 20) })
      ])
    }
  }
  const cardCorners = computed(() => Object.fromEntries(items.value.map((item) => [item.id, cornersFor(item.id)])))

  const items = computed(() => props.items)
  const active = ref(0)
  const current = computed(() => items.value[active.value])
  const total = computed(() => items.value.length)
  // 最新一則貼文的日期（API 依時間新到舊排列，仍取最大值以防順序不同）
  const latest = computed(() => {
    const dates = items.value.map((item) => item.date).sort()
    return dates.length ? fmtDate(dates[dates.length - 1]!) : '—'
  })

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')

  // 內文：貼文的第一行已作為標題，其餘行放在卡片內文；
  // 亂碼效果以 v-html 輸出，先把 < > & 換成外觀相近的全形字元，避免內文被當成 HTML
  const safe = (text: string) => text.replace(/[<>&]/g, (c) => ({ '<': '‹', '>': '›', '&': '＆' })[c]!)
  const bodyText = (item: GalleryItem | undefined) =>
    item ? safe(item.caption.split('\n').slice(1).join('\n').trim()) : ''

  const { output: titleOut, setText: setTitle } = useTextScramble({ duration: 24 })
  const { output: descOut, setText: setDesc } = useTextScramble({ duration: 30 })
  const { output: captionOut, setText: setCaption } = useTextScramble({ duration: 22 })

  const stage = ref<HTMLElement | null>(null)
  const wheel = ref<HTMLElement | null>(null)
  const bgWord = ref<HTMLElement | null>(null)

  let reduceMotion = false
  let ready = false // 進場動畫播完才接受操作

  // ── 輪盤位置 ──
  // state.pos：目前畫面上的位置；target：操作累加出的目標位置，pos 以補間平滑追上（gsap.quickTo）
  const state = { pos: 0 }
  let target = 0
  let stepDeg = 4
  const readStep = () => (wheel.value && parseFloat(getComputedStyle(wheel.value).getPropertyValue('--step'))) || 4
  const maxPos = () => Math.max(0, total.value - 1)
  const OVERSCROLL = 0.35 // 兩端可再多拉的距離（卡片數），放開後彈回
  const clampTarget = (value: number) => gsap.utils.clamp(-OVERSCROLL, maxPos() + OVERSCROLL, value)

  // 依 pos 更新畫面：輪盤旋轉、背景大字反向平移、進度條；最接近中央的卡片切換為目前卡片
  const render = () => {
    gsap.set(wheel.value, { rotation: -state.pos * stepDeg })
    gsap.set(bgWord.value, { xPercent: -state.pos * 1.6 })
    emit('progress', maxPos() ? gsap.utils.clamp(0, 1, state.pos / maxPos()) : 1)
    const index = gsap.utils.clamp(0, maxPos(), Math.round(state.pos))
    if (index !== active.value) {
      active.value = index
      setCaption(bodyText(current.value))
    }
  }

  let posTo: ((value: number) => void) | null = null
  const moveTo = (value: number) => {
    target = clampTarget(value)
    posTo?.(target)
  }

  // 停止操作一小段時間後，吸附到最近的一張（並把超出兩端的拉回）
  const SNAP_DELAY = 160
  let snapTimer: ReturnType<typeof setTimeout> | null = null
  const snapSoon = () => {
    if (snapTimer) clearTimeout(snapTimer)
    snapTimer = setTimeout(() => moveTo(Math.round(gsap.utils.clamp(0, maxPos(), target))), SNAP_DELAY)
  }

  const goTo = (index: number) => {
    if (!ready) return
    if (snapTimer) clearTimeout(snapTimer)
    moveTo(gsap.utils.clamp(0, maxPos(), index))
  }
  const step = (dir: number) => goTo(Math.round(target) + dir)

  // 進場：標題解碼、輪盤由右側轉入
  const intro = () => {
    if (ready || !wheel.value) return
    setTitle(META.title)
    setDesc(META.desc)
    gsap.to(bgWord.value, { autoAlpha: 1, duration: reduceMotion ? 0 : 1.2 })
    gsap.set(wheel.value, { autoAlpha: 1 })
    gsap.fromTo(
      state,
      { pos: -4 },
      {
        pos: 0,
        duration: reduceMotion ? 0 : 1.6,
        ease: 'expo.out',
        onUpdate: render,
        onComplete: () => {
          ready = true
        }
      }
    )
    gsap.fromTo(wheel.value, { opacity: 0 }, { opacity: 1, duration: reduceMotion ? 0 : 0.8 })
    setTimeout(() => setCaption(bodyText(current.value)), reduceMotion ? 0 : 700)
  }

  watch(
    () => props.entered,
    (value) => value && intro()
  )

  // 點擊卡片：兩側卡片 → 轉到該張；中央卡片 → 照常開啟連結。拖曳結束時的點擊不算
  let dragged = false
  const onCardClick = (e: MouseEvent, index: number) => {
    if (dragged || index !== active.value) {
      e.preventDefault()
      if (!dragged) goTo(index)
    }
  }

  // ── 輸入：滾輪 / 觸控 / 拖曳 / 鍵盤 ──
  // 滾輪：位移量連續換算成輪盤位置（WHEEL_PX 的滾動量 = 一張卡），觸控板的慣性也會自然延續
  const WHEEL_PX = 280
  const dominant = (x: number, y: number) => (Math.abs(x) > Math.abs(y) ? x : y)
  const onWheel = (self: Observer) => {
    if (!ready) return
    moveTo(target + dominant(self.deltaX, self.deltaY) / WHEEL_PX)
    snapSoon()
  }

  // 拖曳 / 滑動：輪盤跟著手指走（換算成畫面上相鄰卡片的間距），放開時依速度往前滑一段再吸附
  const spacingPx = () => (wheel.value?.offsetHeight ?? 400) * RADIUS * Math.sin((stepDeg * Math.PI) / 180)
  const onDrag = (self: Observer) => {
    if (!ready) return
    if (snapTimer) clearTimeout(snapTimer)
    moveTo(target - dominant(self.deltaX, self.deltaY) / spacingPx())
  }
  const FLING_MAX = 3
  const onDragEnd = (self: Observer) => {
    if (ready) {
      // 慣性：約 0.18 秒內的移動量（換算成卡片數），最多 3 張，用力甩也不會一路衝到底
      const fling = gsap.utils.clamp(
        -FLING_MAX,
        FLING_MAX,
        (dominant(self.velocityX, self.velocityY) * 0.18) / spacingPx()
      )
      moveTo(Math.round(gsap.utils.clamp(0, maxPos(), target - fling)))
    }
    // 讓緊接著觸發的 click 仍判斷為拖曳，之後再重置
    setTimeout(() => (dragged = false), 0)
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="dialog"]')) return
    const sideMenu = document.querySelector<HTMLElement>('.side-menu')
    if (sideMenu && getComputedStyle(sideMenu).display !== 'none') return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1)
    else return
    e.preventDefault()
  }

  let observer: Observer | null = null
  // 跨越斷點時每格角度改變：重新讀取並立即重繪
  let mq: MediaQueryList | null = null
  const onBreakpoint = () => {
    stepDeg = readStep()
    render()
  }

  onMounted(() => {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    stepDeg = readStep()
    gsap.set(wheel.value, { transformOrigin: ORIGIN, rotation: 0 })
    posTo = gsap.quickTo(state, 'pos', { duration: reduceMotion ? 0 : 0.8, ease: 'power3.out', onUpdate: render })
    observer = Observer.create({
      target: stage.value,
      type: 'wheel,touch,pointer',
      preventDefault: true,
      dragMinimum: 6,
      onWheel,
      onPress: () => (dragged = false),
      onDragStart: () => (dragged = true),
      onDrag,
      onDragEnd
    })
    window.addEventListener('keydown', onKeydown)
    mq = window.matchMedia('(max-width: 767px)')
    mq.addEventListener('change', onBreakpoint)
    if (props.entered) intro()
  })

  onBeforeUnmount(() => {
    observer?.kill()
    if (snapTimer) clearTimeout(snapTimer)
    window.removeEventListener('keydown', onKeydown)
    mq?.removeEventListener('change', onBreakpoint)
    gsap.killTweensOf([state, wheel.value, bgWord.value])
  })
</script>

<template>
  <main class="gallery relative flex h-full w-full flex-col overflow-clip" :class="{ 'is-entered': entered }">
    <!-- 上半部：兩格資訊（參考 kprverse「10,000 unique digital collectibles」區塊的版面）。
         左格：編號＋大標題；右格：帳號、說明與數據。兩格的分隔線位於正中，往下延伸成輪盤的中線 -->
    <header class="band p-line grid shrink-0 border-b-[0.5px] md:grid-cols-2">
      <div class="band-cell relative">
        <p class="dot-caption band-index"><i></i>001</p>
        <h1 class="head-title" v-html="titleOut"></h1>
      </div>
      <div class="band-cell band-side p-line md:border-l-[0.5px]">
        <p class="dot-caption band-label"><i></i>Instagram</p>
        <div class="min-w-0">
          <p class="head-desc" v-html="descOut"></p>
          <dl class="facts">
            <div>
              <dt>Posts</dt>
              <dd class="tabular-nums">{{ pad(total) }}</dd>
            </div>
            <div>
              <dt>Latest</dt>
              <dd class="tabular-nums">{{ latest }}</dd>
            </div>
            <div>
              <dt>Follow</dt>
              <dd>
                <a :href="PROFILE.url" target="_blank" rel="noopener noreferrer" class="link-hover"
                  ><span>{{ PROFILE.handle }} ↗</span></a
                >
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </header>

    <!-- 輪盤區：以 container query 依此區大小換算卡片尺寸 -->
    <div ref="stage" class="stage relative min-h-0 flex-1">
      <!-- 背景大字：重複排列，隨輪盤轉動往反方向平移 -->
      <div class="bg-wrap pointer-events-none absolute inset-x-0" aria-hidden="true">
        <div ref="bgWord" class="bg-word invisible">{{ `${META.word} — `.repeat(8) }}</div>
      </div>
      <!-- 中線＋上下三角標記：延續上方兩格的分隔線，標示輪盤的中心位置 -->
      <span class="guide" aria-hidden="true"></span>
      <span class="guide-mark is-top" aria-hidden="true"></span>
      <span class="guide-mark is-bottom" aria-hidden="true"></span>
      <div ref="wheel" class="wheel invisible">
        <a
          v-for="(item, i) in items"
          :key="item.id"
          :href="item.link"
          target="_blank"
          rel="noopener noreferrer"
          class="card"
          :class="{ 'is-active': i === active }"
          :style="{ '--i': i }"
          :tabindex="i === active ? 0 : -1"
          :aria-hidden="i !== active || undefined"
          :aria-label="`${item.title}（在 ${META.source} 開啟）`"
          draggable="false"
          @click="onCardClick($event, i)"
        >
          <div class="card-inner">
            <!-- 外框角型：每張卡片隨機組合（見 cornersFor），語彙同首頁的 TechFrame -->
            <TechFrame
              :stroke-width="1"
              stroke="rgb(255 255 255 / 0.2)"
              v-bind="cardCorners[item.id]"
              class="card-frame absolute inset-0"
            >
              <img :src="item.image" :alt="item.title" class="card-img" loading="lazy" draggable="false" />
              <!-- 下方漸層（文字底）＋ 非目前卡片的壓暗層：放在框內，跟著外框的形狀一起裁切 -->
              <span class="card-gradient"></span>
              <span class="card-shade"></span>
            </TechFrame>

            <!-- 頂部 HUD：來源 / 序號、類型 -->
            <div class="card-hud">
              <span>{{ META.tag }} / {{ pad(i + 1) }}</span>
              <span class="truncate">{{ item.kind }}</span>
            </div>

            <!-- 內文：只在目前卡片顯示，內文以亂碼解碼 -->
            <div class="card-body">
              <time :datetime="item.date" class="card-date">{{ fmtDate(item.date) }}</time>
              <h2 class="card-title">{{ item.title }}</h2>
              <p v-if="i === active" class="card-caption" v-html="captionOut"></p>
              <p class="card-stats">
                <span v-for="stat in item.stats" :key="stat.label"
                  ><b>{{ stat.value.toLocaleString('en-US') }}</b> {{ stat.label }}</span
                >
              </p>
            </div>
            <span class="card-cta">View ↗</span>
          </div>
        </a>
      </div>
    </div>

    <!-- 底部操作列：上一張 / 序號 / 下一張、操作提示、原始連結 -->
    <div
      class="bar p-line relative z-10 flex shrink-0 items-center justify-between gap-4 border-t-[0.5px] px-4 md:px-6 text-xs"
    >
      <div class="flex items-center gap-3">
        <button type="button" class="arrow" aria-label="上一張" :disabled="active === 0" @click="step(-1)">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
            <path d="M11 6H1.5M5.5 2L1.5 6l4 4" />
          </svg>
        </button>
        <span class="tabular-nums tracking-wider whitespace-nowrap">{{ pad(active + 1) }} / {{ pad(total) }}</span>
        <button type="button" class="arrow" aria-label="下一張" :disabled="active >= total - 1" @click="step(1)">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
            <path d="M1 6h9.5M6.5 2l4 4-4 4" />
          </svg>
        </button>
      </div>
      <span class="hidden md:block opacity-50 tracking-wider">SCROLL · DRAG · ← → TO EXPLORE</span>
      <a
        v-if="current"
        :href="current.link"
        target="_blank"
        rel="noopener noreferrer"
        class="link-hover whitespace-nowrap"
        ><span><span class="max-md:hidden">View on </span>{{ META.source }} ↗</span></a
      >
    </div>
  </main>
</template>

<style lang="scss" scoped>
  .p-line {
    border-color: var(--panel-line, rgb(255 255 255 / 0.5));
  }

  /* ── 背景大字 ── */
  .bg-wrap {
    top: 50%;
    translate: 0 -50%;
  }

  .bg-word {
    padding-left: 4%;
    font-size: clamp(80px, 36cqh, 280px); /* 依輪盤區高度（container query） */
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    color: rgb(255 255 255 / 0.045);
  }

  /* ── 上半部兩格 ── */
  .band-cell {
    padding: 16px;

    @media (min-width: 768px) {
      padding: 28px 24px 32px;
    }
  }

  .dot-caption {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;

    i {
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  /* 編號放在標題第一行的縮排處（同 kprverse 的「■ 004」） */
  .band-index {
    position: absolute;
    top: calc(16px + 0.5em);

    @media (min-width: 768px) {
      top: calc(28px + 0.9em);
    }
  }

  .head-title {
    min-height: 2.1em;
    font-size: clamp(26px, 3.4vw, 52px);
    font-weight: 700;
    line-height: 1.02;
    text-transform: uppercase;
    text-indent: 2.2em;
  }

  /* 右格：桌機為「標籤欄＋內容」左右排列；行動版只留內容 */
  .band-side {
    display: flex;
    gap: 24px;
    padding-top: 0;

    @media (min-width: 768px) {
      padding-top: 28px;
    }
  }

  .band-label {
    flex-shrink: 0;
    width: 96px;
    align-self: flex-start;
    margin-top: 3px;

    @media (max-width: 1023px) {
      display: none;
    }
  }

  .head-desc {
    min-height: 3em;
    max-width: 30rem;
    font-size: 12px;
    line-height: 1.5;
    opacity: 0.75;

    @media (min-width: 768px) {
      font-size: 13px;
    }
  }

  /* 數據列：小標＋數值，三欄並排 */
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 28px;
    margin-top: 14px;
    font-size: 11px;
    letter-spacing: 0.06em;
    opacity: 0;
    translate: 0 6px;
    transition:
      opacity 0.6s,
      translate 0.6s cubic-bezier(0.22, 1, 0.36, 1);

    dt {
      font-size: 9px;
      text-transform: uppercase;
      opacity: 0.5;
    }

    dd {
      margin-top: 2px;
    }

    .link-hover {
      margin-left: -4px;
    }
  }

  .is-entered .facts {
    opacity: 1;
    translate: 0 0;
    transition-delay: 0.8s;
  }

  /* ── 輪盤 ──
     卡片高取「輪盤區高 78%」與「輪盤區寬 56% 換算的高」較小者（行動版窄螢幕以寬度為限）；寬高比 4:5，置中 */
  .stage {
    container-type: size;
    touch-action: none;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  /* 中線：延續上方兩格的分隔線（main 寬的 50%），進場時由上往下畫出 */
  .guide {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    border-left: 0.5px solid var(--panel-line, rgb(255 255 255 / 0.5));
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 1s cubic-bezier(0.65, 0, 0.35, 1) 0.2s;
  }

  .guide-mark {
    position: absolute;
    left: 50%;
    translate: -50% 0;
    border-inline: 5px solid transparent;
    opacity: 0;
    transition: opacity 0.4s 0.9s;

    &.is-top {
      top: 12px;
      border-top: 7px solid currentColor;
    }

    &.is-bottom {
      bottom: 12px;
      border-bottom: 7px solid currentColor;
    }
  }

  .is-entered {
    .guide {
      transform: scaleY(1);
    }
    .guide-mark {
      opacity: 1;
    }
  }

  .wheel {
    --step: 4deg;
    --card-h: min(78cqh, 56cqw * 1.25);
    --card-w: calc(var(--card-h) * 0.8);
    position: absolute;
    left: calc(50% - var(--card-w) / 2);
    top: calc(50% - var(--card-h) / 2);
    width: var(--card-w);
    height: var(--card-h);

    @media (max-width: 767px) {
      --step: 3deg;
      --card-h: min(80cqh, 78cqw * 1.25);
    }
  }

  .card {
    position: absolute;
    inset: 0;
    transform: rotate(calc(var(--i) * var(--step)));
    transform-origin: 50% 1450%; /* 同 script 的 ORIGIN */
    cursor: pointer;
    -webkit-user-drag: none;
    user-select: none;

    &:focus-visible {
      outline: none;

      .card-inner {
        outline: 1px dashed #fff;
        outline-offset: 6px;
      }
    }
  }

  /* 卡片本體：非目前卡片略縮小；文字依卡片寬度縮放（container query） */
  .card-inner {
    position: absolute;
    inset: 0;
    container-type: inline-size;
    scale: 0.9;
    transition: scale 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .card-frame :deep(img) {
    -webkit-user-drag: none;
  }

  .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: scale 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .card-gradient,
  .card-shade {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .card-gradient {
    /* 下方：內文底；上方：頂部 HUD 文字底（亮色照片上也看得清楚） */
    background:
      linear-gradient(to top, rgb(0 0 0 / 0.85), rgb(0 0 0 / 0.25) 45%, transparent 70%),
      linear-gradient(to bottom, rgb(0 0 0 / 0.45), transparent 22%);
  }

  .card-shade {
    background: rgb(11 11 11 / 0.78);
    transition: opacity 0.6s cubic-bezier(0.15, 0.84, 0.44, 1);
  }

  .card-hud {
    position: absolute;
    inset: 0 0 auto;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: max(10px, 4.5cqw) max(12px, 5.5cqw);
    padding-right: max(40px, 10cqw); /* 避開右上斜切角 */
    font-size: max(9px, 3cqw);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.75;
    /* 壓在亮色照片上（例如天空）時仍看得清楚 */
    text-shadow: 0 1px 6px rgb(0 0 0 / 0.6);
  }

  .card-body {
    position: absolute;
    inset: auto 0 0;
    padding: max(12px, 5.5cqw);
    padding-bottom: max(30px, 8cqw); /* 避開左下缺角 */
    opacity: 0;
    translate: 0 12px;
    transition:
      opacity 0.4s,
      translate 0.4s;
  }

  .card-date {
    font-size: max(9px, 2.8cqw);
    letter-spacing: 0.1em;
    opacity: 0.7;
  }

  .card-title {
    margin-top: 0.4em;
    font-size: max(14px, 6cqw);
    font-weight: 700;
    line-height: 1.15;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-caption {
    margin-top: 0.7em;
    font-size: max(10px, 3.3cqw);
    line-height: 1.55;
    white-space: pre-line;
    opacity: 0.8;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;

    @container (max-width: 240px) {
      -webkit-line-clamp: 2;
    }
  }

  .card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4em 1.2em;
    margin-top: 0.9em;
    font-size: max(9px, 2.8cqw);
    letter-spacing: 0.06em;
    opacity: 0.75;
  }

  /* 右上角「View ↗」：目前卡片 hover 時出現 */
  .card-cta {
    position: absolute;
    right: max(12px, 5cqw);
    bottom: max(12px, 5cqw);
    padding: 4px 10px;
    font-size: max(9px, 2.8cqw);
    font-weight: 700;
    background: #fff;
    color: #000;
    opacity: 0;
    translate: 0 6px;
    transition:
      opacity 0.3s,
      translate 0.3s;
  }

  /* 目前卡片：恢復原尺寸、移除壓暗、顯示內文 */
  .card.is-active {
    .card-inner {
      scale: 1;
    }
    .card-shade {
      opacity: 0;
    }
    .card-body {
      opacity: 1;
      translate: 0 0;
      transition:
        opacity 0.5s 0.25s,
        translate 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.25s;
    }

    &:hover {
      .card-img {
        scale: 1.05;
      }
      .card-cta {
        opacity: 1;
        translate: 0 0;
      }
    }
  }

  /* ── 底部操作列 ── */
  .bar {
    height: 48px;
    opacity: 0;
    translate: 0 100%;
    transition:
      opacity 0.6s,
      translate 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .is-entered .bar {
    opacity: 1;
    translate: 0 0;
    transition-delay: 0.6s;
  }

  .arrow {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0.5px solid var(--panel-line, rgb(255 255 255 / 0.5));
    border-radius: 50%;
    cursor: pointer;
    transition:
      background-color 0.3s,
      color 0.3s,
      opacity 0.3s;

    svg {
      width: 11px;
      height: 11px;
    }

    &:hover:not(:disabled),
    &:focus-visible {
      outline: none;
      background: var(--panel-fg, #fff);
      color: var(--panel-bg, #000);
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  /* 文字連結：hover 時白底由左往右刷入、文字反黑（同側選單） */
  .link-hover {
    position: relative;
    padding: 2px 4px;
    letter-spacing: 0.04em;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--panel-fg, #fff);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s cubic-bezier(0.7, 0, 0.3, 1);
    }

    > span {
      position: relative;
    }

    &:hover,
    &:focus-visible {
      outline: none;
      color: var(--panel-bg, #000);

      &::before {
        transform: scaleX(1);
      }
    }
  }

  :deep(.scramble-dud) {
    opacity: 0.6;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-inner,
    .card-img,
    .card-body,
    .card-shade {
      transition: none !important;
    }
  }
</style>
