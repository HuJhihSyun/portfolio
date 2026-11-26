<script setup lang="ts">
  import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import type { GalleryItem } from '#shared/gallery'
  import { SOCIAL_LINKS } from '#shared/profile'

  /**
   * GalleryWorks：Gallery 頁的 Works 區（Behance 作品），版面參考 kprverse Gallery 頁：
   * 左欄為大標題＋分類篩選（依「大類 · 細類」分組，見 server/content/behance-works.ts），右側為數量 / 目前篩選＋作品格狀排列。
   * 接在 GalleryPosts 最後一張大圖滑走之後（由 gallery.vue 呼叫 addTo 接進主 timeline）：
   *   1. 進場（捲動補間）：左欄由左滑入、篩選項目依序浮現、作品區由下方升起
   *   2. 瀏覽（捲動補間）：作品格隨捲動往上捲（超出可視範圍的高度以 CSS 變數 --overflow 換算）
   * 進場完成後（時間驅動）：標題 / 數量解碼、作品卡依序浮現。
   * 切換分類（時間驅動）：目前的卡片由下往上擦除退場 → 換成新清單 → 新卡片依序升起、封面由下往上展開、標題解碼。
   */

  const props = defineProps<{ items: GalleryItem[] }>()
  const emit = defineEmits<{ seek: [time: number] }>()

  const behanceUrl = SOCIAL_LINKS.find((link) => link.label === 'Behance')?.url ?? 'https://www.behance.net/'
  const META = {
    index: '004',
    title: 'Selected Works',
    desc: 'Client projects from my Behance portfolio — campaign sites, interactive experiences, EDM and print.'
  }

  // ── 分類：kind 為「大類 · 細類」（例如 Web · Interactive）；沒有「·」時整個字串視為大類 ──
  type FilterKey = 'all' | `g:${string}` | `s:${string}`
  const split = (kind: string) => {
    const [group = 'Other', sub] = kind.split('·').map((part) => part.trim())
    return { group: group || 'Other', sub }
  }
  const groups = computed(() => {
    const map = new Map<string, { name: string; count: number; subs: Map<string, number> }>()
    for (const item of props.items) {
      const { group, sub } = split(item.kind)
      const entry = map.get(group) ?? { name: group, count: 0, subs: new Map() }
      entry.count++
      if (sub) entry.subs.set(sub, (entry.subs.get(sub) ?? 0) + 1)
      map.set(group, entry)
    }
    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        ...g,
        subs: [...g.subs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }))
      }))
  })

  const filter = ref<FilterKey>('all')
  const matches = (item: GalleryItem, key: FilterKey) => {
    if (key === 'all') return true
    const { group, sub } = split(item.kind)
    return key.startsWith('g:') ? group === key.slice(2) : `${group} · ${sub}` === key.slice(2)
  }
  const visible = computed(() => props.items.filter((item) => matches(item, filter.value)))
  const filterLabel = (key: FilterKey) => (key === 'all' ? 'All works' : key.slice(2))

  const pad = (n: number) => String(n).padStart(2, '0')
  const countText = (n: number) => `${pad(n)} ${n === 1 ? 'work' : 'works'}`

  const { output: titleOut, setText: setTitle } = useTextScramble({ duration: 24 })
  const { output: countOut, setText: setCount } = useTextScramble({ duration: 16 })
  const { output: chipOut, setText: setChip } = useTextScramble({ duration: 16 })
  countOut.value = countText(props.items.length)
  chipOut.value = filterLabel('all')

  const root = ref<HTMLElement | null>(null)
  const aside = ref<HTMLElement | null>(null)
  const head = ref<HTMLElement | null>(null)
  const viewport = ref<HTMLElement | null>(null)
  const grid = ref<HTMLElement | null>(null)
  const cardRefs = ref<{ play: () => void }[]>([])

  let reduceMotion = false
  const cardEls = () => [...(grid.value?.querySelectorAll<HTMLElement>('.work-card') ?? [])]
  const mediaEls = () => [...(grid.value?.querySelectorAll<HTMLElement>('.work-media') ?? [])]
  const imgEls = () => [...(grid.value?.querySelectorAll<HTMLElement>('.work-img') ?? [])]

  // 作品卡依序升起、封面由下往上展開（kprverse 切換篩選時圖片逐張出現的節奏）、標題解碼
  const revealCards = () => {
    const cards = cardEls()
    gsap.killTweensOf([...cards, ...mediaEls(), ...imgEls()])
    if (reduceMotion) {
      gsap.set(cards, { autoAlpha: 1, y: 0, clipPath: 'none' })
      return
    }
    gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 32, clipPath: 'inset(0% 0% 0% 0%)' },
      { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.05, clearProps: 'clipPath' }
    )
    gsap.fromTo(
      mediaEls(),
      { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.out', stagger: 0.05, delay: 0.1, clearProps: 'clipPath' }
    )
    gsap.fromTo(imgEls(), { scale: 1.2 }, { scale: 1, duration: 1.1, ease: 'expo.out', stagger: 0.05, delay: 0.1, clearProps: 'scale' })
    cardRefs.value.forEach((card, i) => setTimeout(() => card?.play(), 150 + i * 50))
  }

  // ── 進場完成後的解碼與卡片浮現（依捲動時間切換，往回捲離開時重置，下次進場再播） ──
  let readyAt = Infinity
  let scrollAt = Infinity // 作品格開始隨捲動往上捲的時間
  let revealed = false
  let lastTime = 0
  const onScroll = (time: number) => {
    lastTime = time
    const show = time >= readyAt - 0.3
    if (show === revealed) return
    revealed = show
    if (show) {
      setTitle(META.title)
      setCount(countText(visible.value.length))
      setChip(filterLabel(filter.value))
      revealCards()
    } else {
      setTitle('')
      gsap.killTweensOf(cardEls())
      gsap.set(cardEls(), { autoAlpha: 0 })
    }
  }

  // ── 切換分類 ──
  let switching = false
  let queued: FilterKey | null = null
  const select = async (key: FilterKey) => {
    if (key === filter.value && !switching) return
    if (switching) {
      queued = key
      return
    }
    switching = true
    // 1. 目前的卡片由下往上擦除、微微上移（依序）
    const cards = cardEls()
    gsap.killTweensOf(cards)
    if (!reduceMotion && cards.length) {
      await gsap.to(cards, {
        autoAlpha: 0,
        y: -14,
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: 0.32,
        ease: 'power2.in',
        stagger: { each: 0.02, from: 'start' }
      })
    }
    // 2. 換成新清單；作品格已往下捲時，捲回作品區開頭
    filter.value = key
    setCount(countText(visible.value.length))
    setChip(filterLabel(key))
    if (lastTime > scrollAt + 0.02) emit('seek', scrollAt)
    await nextTick()
    // 3. 新卡片依序浮現
    revealCards()
    switching = false
    if (queued && queued !== filter.value) {
      const next = queued
      queued = null
      select(next)
    }
    queued = null
  }

  // ── 作品格超出可視範圍的高度（px）：寫進 CSS 變數，捲動補間 --scroll（0 → 1）換算成位移 ──
  let ro: ResizeObserver | null = null
  const measure = () => {
    if (!viewport.value || !grid.value) return
    const overflow = Math.max(0, grid.value.offsetHeight - viewport.value.clientHeight)
    viewport.value.style.setProperty('--overflow', String(overflow))
  }

  const WORKS_IN = 0.9 // 進場長度
  const SCROLL_PER_ROW = 0.45 // 作品格每多一列（超出可視範圍）增加的捲動長度

  /** 接進主 timeline：at = 開始進場的時間（前一段的大圖滑走中）；回傳進場完成的時間點 */
  const addTo = (tl: gsap.core.Timeline, isMobile: boolean, at: number) => {
    readyAt = at + WORKS_IN
    scrollAt = readyAt + 0.2
    // 欄數同 .works-grid（< 640px 一欄）；只用來估算捲動長度
    const cols = window.innerWidth < 640 ? 1 : isMobile ? 2 : 3
    const rows = Math.ceil(props.items.length / cols)
    // 一欄時每列較高（卡片滿寬），每列給較長的捲動距離，捲動手感才接近 1:1
    const perRow = cols === 1 ? SCROLL_PER_ROW * 1.8 : SCROLL_PER_ROW
    const scrollDur = Math.max(0.8, (rows - (cols === 1 ? 1 : isMobile ? 2 : 1.5)) * perRow)
    const rowsEls = aside.value?.querySelectorAll('.filter-row') ?? []

    // 起始狀態寫在 timeline 起點（ScrollTrigger 重新量測時才不會被清掉）
    tl.set(root.value, { autoAlpha: 0 }, 0)

    tl.fromTo(root.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, at)
      .fromTo(
        aside.value,
        isMobile ? { y: -24, autoAlpha: 0 } : { x: -48, autoAlpha: 0 },
        { x: 0, y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', immediateRender: false },
        at
      )
      .fromTo(
        rowsEls,
        { y: 14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.4, ease: 'power2.out', stagger: 0.03, immediateRender: false },
        at + 0.15
      )
      .fromTo(
        head.value,
        { autoAlpha: 0, y: -10 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', immediateRender: false },
        at + 0.2
      )
      .fromTo(
        viewport.value,
        { autoAlpha: 0, y: 80 },
        { autoAlpha: 1, y: 0, duration: WORKS_IN - 0.1, ease: 'power3.out', immediateRender: false },
        at + 0.1
      )
      // 瀏覽：作品格隨捲動往上捲
      .fromTo(viewport.value, { '--scroll': 0 }, { '--scroll': 1, duration: scrollDur }, scrollAt)

    return { readyAt }
  }

  onMounted(() => {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.set(cardEls(), { autoAlpha: 0 })
    ro = new ResizeObserver(measure)
    if (viewport.value) ro.observe(viewport.value)
    if (grid.value) ro.observe(grid.value)
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    gsap.killTweensOf([...cardEls(), ...mediaEls(), ...imgEls()])
  })

  defineExpose({ addTo, onScroll })
</script>

<template>
  <!-- id 不用 works：避免瀏覽器對 #works 做原生錨點捲動（區塊位在固定定位的 Panel 內，捲動位置由 gallery.vue 換算） -->
  <section
    id="gallery-works"
    ref="root"
    class="works invisible absolute inset-0 z-20 flex flex-col md:flex-row"
    aria-labelledby="works-title"
  >
    <!-- 左欄：標題＋分類篩選（行動版改為上方一列可橫向捲動的選項） -->
    <aside ref="aside" class="works-aside p-line shrink-0 md:border-r-[0.5px]">
      <p class="dot-caption"><i></i>{{ META.index }} · Behance</p>
      <h2 id="works-title" class="works-title">
        <span class="sr-only">{{ META.title }}</span>
        <span aria-hidden="true" v-html="titleOut"></span>
      </h2>
      <p class="works-desc">{{ META.desc }}</p>

      <ul class="filter-list" aria-label="作品分類">
        <li class="filter-row filter-all">
          <button type="button" class="filter-btn" :aria-pressed="filter === 'all'" @click="select('all')">
            <span class="filter-box" aria-hidden="true"></span>
            <span class="filter-name">All works</span>
            <span class="filter-count tabular-nums">{{ pad(items.length) }}</span>
          </button>
        </li>
        <li v-for="group in groups" :key="group.name" class="filter-group">
          <button
            type="button"
            class="filter-row filter-btn filter-head"
            :aria-pressed="filter === `g:${group.name}`"
            @click="select(`g:${group.name}`)"
          >
            <span class="filter-box" aria-hidden="true"></span>
            <span class="filter-name">{{ group.name }}</span>
            <span class="filter-count tabular-nums">{{ pad(group.count) }}</span>
          </button>
          <ul class="filter-subs">
            <li v-for="sub in group.subs" :key="sub.name" class="filter-row">
              <button
                type="button"
                class="filter-btn filter-sub"
                :aria-pressed="filter === `s:${group.name} · ${sub.name}`"
                @click="select(`s:${group.name} · ${sub.name}`)"
              >
                <span class="filter-box" aria-hidden="true"></span>
                <span class="filter-name">{{ sub.name }}</span>
                <span class="filter-count tabular-nums">({{ sub.count }})</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>

      <a :href="behanceUrl" target="_blank" rel="noopener noreferrer" class="works-more filter-row link-hover"
        ><span>View all on Behance ↗</span></a
      >
    </aside>

    <!-- 右側：數量與目前篩選＋作品格 -->
    <div class="works-main flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref="head" class="works-head p-line flex shrink-0 items-center gap-3 border-b-[0.5px]">
        <span class="works-count tabular-nums" aria-live="polite">
          <span class="sr-only">{{ countText(visible.length) }}</span>
          <span aria-hidden="true" v-html="countOut"></span>
        </span>
        <button
          type="button"
          class="works-chip"
          :class="{ 'is-clearable': filter !== 'all' }"
          :disabled="filter === 'all'"
          :aria-label="filter === 'all' ? undefined : `清除篩選：${filterLabel(filter)}`"
          @click="select('all')"
        >
          <span aria-hidden="true" v-html="chipOut"></span>
          <span v-if="filter !== 'all'" class="works-chip-x" aria-hidden="true">✕</span>
        </button>
      </div>
      <div ref="viewport" class="works-viewport relative min-h-0 flex-1 overflow-hidden">
        <ul ref="grid" class="works-grid">
          <GalleryWorkCard
            v-for="(item, i) in visible"
            :key="item.id"
            ref="cardRefs"
            :item="item"
            :index="i"
          />
        </ul>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
  .works {
    background: transparent;
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

  /* ── 左欄 ── */
  .works-aside {
    display: flex;
    flex-direction: column;
    padding: 16px 16px 12px;

    /* 高度不足時改為左欄內捲動，各區塊不被壓縮（否則標題換行時會與說明重疊） */
    > * {
      flex-shrink: 0;
    }

    @media (min-width: 768px) {
      width: clamp(240px, 22vw, 320px);
      padding: 28px 24px 24px;
      overflow-y: auto;
      scrollbar-width: none;
    }
  }

  .works-title {
    min-height: 1.05em;
    margin-top: 10px;
    font-size: clamp(28px, 3.2vw, 48px);
    font-weight: 700;
    line-height: 1.02;
    text-transform: uppercase;
  }

  .works-desc {
    max-width: 22rem;
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.5;
    opacity: 0.7;

    @media (max-width: 767px) {
      display: none;
    }
  }

  /* 篩選清單：桌機為直式分組清單（細分隔線）；行動版攤平成一列橫向捲動的選項 */
  .filter-list {
    margin: 24px 0 20px;
    border-top: 0.5px solid var(--panel-line);

    @media (max-width: 767px) {
      display: flex;
      gap: 6px;
      margin: 12px -16px 0;
      padding: 0 16px 2px;
      border-top: 0;
      overflow-x: auto;
      scrollbar-width: none;

      .filter-group,
      .filter-subs {
        display: contents;
      }
    }
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 0;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.3s;

    @media (max-width: 767px) {
      flex-shrink: 0;
      width: auto;
      gap: 6px;
      padding: 6px 10px;
      border: 0.5px solid var(--panel-line);
      border-radius: 999px;
      white-space: nowrap;
    }
  }

  .filter-all .filter-btn,
  .filter-head {
    border-bottom: 0.5px solid var(--panel-line);
    font-weight: 700;

    @media (max-width: 767px) {
      border-bottom: 0.5px solid var(--panel-line);
    }
  }

  .filter-subs {
    padding: 4px 0 10px;
    border-bottom: 0.5px solid var(--panel-line);
  }

  .filter-sub {
    padding: 5px 0 5px 2px;
    font-size: 10px;
    opacity: 0.6;

    @media (max-width: 767px) {
      padding: 6px 10px;
    }
  }

  /* 方框標記：選取時填滿（同 kprverse 篩選的勾選框） */
  .filter-box {
    position: relative;
    flex-shrink: 0;
    width: 9px;
    height: 9px;
    border: 0.5px solid currentColor;

    &::after {
      content: '';
      position: absolute;
      inset: 1.5px;
      background: currentColor;
      transform: scale(0);
      transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }

    @media (max-width: 767px) {
      display: none;
    }
  }

  .filter-name {
    flex: 1;
    min-width: 0;
  }

  .filter-count {
    opacity: 0.5;
  }

  .filter-btn[aria-pressed='true'] {
    opacity: 1;

    .filter-box::after {
      transform: scale(1);
    }

    .filter-name {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    @media (max-width: 767px) {
      background: var(--panel-fg);
      color: var(--panel-bg);

      .filter-name {
        text-decoration: none;
      }
    }
  }

  @media (hover: hover) {
    .filter-btn:hover {
      opacity: 1;

      .filter-name {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
  }

  .works-more {
    align-self: flex-start;
    margin-top: auto;
    translate: 0 0;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;

    @media (max-width: 767px) {
      display: none;
    }
  }

  /* ── 右側 ── */
  .works-head {
    min-height: 44px;
    padding: 0 16px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;

    @media (min-width: 768px) {
      min-height: 52px;
      padding: 0 24px;
    }
  }

  .works-count {
    opacity: 0.6;
  }

  /* 目前篩選：有篩選時可點擊清除（同 kprverse 的篩選標籤） */
  .works-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    border: 0.5px solid var(--panel-line);
    border-radius: 999px;
    opacity: 0.6;

    &.is-clearable {
      opacity: 1;
      cursor: pointer;
    }
  }

  .works-chip-x {
    font-size: 9px;
  }

  /* 文字連結：hover 時白底由左往右刷入、文字反黑（同側選單 / Posts 區） */
  .link-hover {
    position: relative;
    margin-left: -4px;
    padding: 2px 4px;

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

  /* 作品格：隨捲動往上位移（--scroll 由 timeline 補間，--overflow 為超出可視範圍的高度 px） */
  /* 欄數：< 640px 一欄、640～767px 兩欄、≥ 768px 依寬度自動排（每欄至少 220px） */
  .works-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 24px 12px;

    @media (min-width: 640px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    padding: 16px 16px 32px;
    translate: 0 calc(var(--scroll, 0) * var(--overflow, 0) * -1px);

    @media (min-width: 768px) {
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 36px 24px;
      padding: 24px 24px 40px;
    }
  }
</style>
