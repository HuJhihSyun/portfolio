<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import { ARTICLE_CHAPTERS, STATUS_LABEL } from '#shared/articles'

  gsap.registerPlugin(ScrollTrigger)

  /**
   * Articles 頁：版面參考 kprverse Protocol 頁的 Panel —— 細線切出的不規則格線，文字依格陳列。
   *   開頭：巨型標題 ARTICLES、兩側小標、簡介
   *   每個分類（章節）：
   *     - 標題列：左格為「■ CHAPTER 01」＋大標＋簡介，右格（26%）為線條圖示與文章數
   *     - 文章列表：只佔右半部（左側留白露出背景照片），每篇以細線分隔
   *     - 底列：三格不等寬（斜線格 / 標籤 / 補充說明）
   *   結尾：一句話＋回到頂端
   * 內容在 Panel 內隨頁面捲動（ScrollTrigger 平滑跟隨），背景 ArticlesScene 依捲動進度由上往下移動。
   * 分類與文章為假內容（shared/articles.ts），之後換成真正的文章。
   */

  useSiteSeo('articles')

  const HERO = {
    title: 'Articles',
    left: 'Notes / Journal',
    right: 'Code · Motion · Design · Life',
    intro:
      'Writing about the craft behind the screen — front-end architecture, motion that serves a purpose, the design decisions in between, and the life that happens away from the keyboard.'
  }
  const OUTRO = {
    title: 'More soon.',
    text: 'The first articles are being written. Until then, the work lives in the Gallery and on GitHub.'
  }

  const chapters = ARTICLE_CHAPTERS
  type SectionKey = 'intro' | (typeof chapters)[number]['key']
  const TABS: { label: string; key: SectionKey }[] = [
    { label: 'Intro', key: 'intro' },
    ...chapters.map((chapter) => ({ label: chapter.label, key: chapter.key }))
  ]
  const section = ref<SectionKey>('intro')

  const pad = (n: number) => String(n).padStart(2, '0')

  // 標題解碼：開頭標題於進場時、各章大標於捲入畫面時播放一次
  const { output: heroOut, setText: setHero } = useTextScramble({ duration: 30 })
  const titleScrambles = chapters.map(() => useTextScramble({ duration: 26 }))

  const panelTheme = {
    '--panel-fg': '#fff',
    '--panel-bg': '#0b0b0b',
    '--panel-line': 'rgb(255 255 255 / 0.28)'
  }

  const root = ref<HTMLElement | null>(null)
  const spacer = ref<HTMLElement | null>(null)
  const viewport = ref<HTMLElement | null>(null)
  const flow = ref<HTMLElement | null>(null)
  const chapterEls = ref<HTMLElement[]>([])
  const titleEls = ref<HTMLElement[]>([])
  const shell = ref<{ setProgress: (progress: number) => void } | null>(null)
  const sceneRef = ref<{ setProgress: (progress: number) => void } | null>(null)

  // ── 捲動：內容在 Panel 內往上移動 scrollLen（= 內容高 − 可視高），頁面捲動距離與之 1:1 ──
  let scrollLen = 0
  let tl: gsap.core.Timeline | null = null
  let trigger: ScrollTrigger | null = null

  const measure = () => {
    if (!viewport.value || !flow.value) return
    const viewH = viewport.value.clientHeight
    flow.value.style.setProperty('--view-h', `${viewH}px`)
    scrollLen = Math.max(0, flow.value.scrollHeight - viewH)
    if (spacer.value) spacer.value.style.height = `${scrollLen + window.innerHeight}px`
  }

  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const remeasure = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      measure()
      ScrollTrigger.refresh()
    }, 120)
  }

  const buildScroll = () => {
    if (tl) return
    measure()
    tl = gsap.timeline({
      paused: true,
      onUpdate: () => {
        const p = tl?.progress() ?? 0
        shell.value?.setProgress(p)
        sceneRef.value?.setProgress(p)
        updateSection(p)
      }
    })
    tl.fromTo(flow.value, { y: 0 }, { y: () => -scrollLen, ease: 'none', duration: 1 })
    trigger = ScrollTrigger.create({
      animation: tl,
      trigger: root.value,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      invalidateOnRefresh: true
    })
  }

  // 目前所在的分類：可視區上方 40% 的位置落在哪一章
  const updateSection = (p: number) => {
    const viewH = viewport.value?.clientHeight ?? 0
    const line = p * scrollLen + viewH * 0.4
    let current: SectionKey = 'intro'
    chapterEls.value.forEach((el, i) => {
      if (el && el.offsetTop <= line) current = chapters[i]!.key
    })
    section.value = current
  }

  // 頂部選單 / 回到頂端：捲到該段落（ScrollTrigger 還沒量測時以頁面可捲動範圍推算）
  const scrollToOffset = (offset: number) => {
    if (!trigger || !scrollLen) return
    const start = Number.isFinite(trigger.start) ? trigger.start : 0
    const end = Number.isFinite(trigger.end) ? trigger.end : document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: start + (Math.min(offset, scrollLen) / scrollLen) * (end - start), behavior: 'smooth' })
  }
  const goTo = (key: SectionKey) => {
    if (key === 'intro') return scrollToOffset(0)
    const index = chapters.findIndex((chapter) => chapter.key === key)
    const el = chapterEls.value[index]
    if (el) scrollToOffset(el.offsetTop)
  }

  // 各章大標捲入畫面時解碼一次
  let observer: IntersectionObserver | null = null
  const watchTitles = () => {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const i = titleEls.value.indexOf(entry.target as HTMLElement)
          if (i >= 0) titleScrambles[i]?.setText(chapters[i]!.title)
          observer?.unobserve(entry.target)
        })
      },
      { threshold: 0.4 }
    )
    titleEls.value.forEach((el) => el && observer!.observe(el))
  }

  // 開場 loading 結束（直接開啟約 3 秒；站內換頁時等轉場退去）後：標題解碼、建立捲動
  const { onLoaded } = useGlobalLoading()
  let cancelEnter: (() => void) | null = null
  let ro: ResizeObserver | null = null
  onMounted(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    measure()
    ro = new ResizeObserver(remeasure)
    if (flow.value) ro.observe(flow.value)
    if (viewport.value) ro.observe(viewport.value)
    cancelEnter = onLoaded(() => {
      setHero(HERO.title)
      buildScroll()
      watchTitles()
    })
  })
  onBeforeUnmount(() => {
    cancelEnter?.()
    clearTimeout(refreshTimer)
    ro?.disconnect()
    observer?.disconnect()
    trigger?.kill()
    tl?.kill()
  })
</script>

<template>
  <div ref="root" class="w-full">
    <!-- 背景：分層照片場景（固定全螢幕，墊在 Panel 之後） -->
    <ArticlesScene ref="sceneRef" />

    <div class="relative z-10 w-full p-3 md:p-6" :style="panelTheme">
      <PanelShell ref="shell" :items="TABS" :active="section" @navigate="goTo">
        <main ref="viewport" class="articles relative h-full min-w-0 flex-1 overflow-hidden text-white">
          <div ref="flow" class="flow">
            <!-- ── 開頭 ── -->
            <section class="hero p-line flex flex-col border-b-[0.5px]">
              <h1 class="hero-title">
                <span class="sr-only">{{ HERO.title }}</span>
                <span aria-hidden="true" v-html="heroOut"></span>
              </h1>
              <div class="hero-meta flex justify-between gap-6">
                <p class="dot-caption"><i></i>{{ HERO.left }}</p>
                <p class="dot-caption"><i></i>{{ HERO.right }}</p>
              </div>
              <div class="hero-bottom mt-auto flex flex-col gap-8 md:flex-row md:items-end md:justify-end md:gap-12">
                <p class="hero-intro">{{ HERO.intro }}</p>
                <div class="hero-index hidden md:block">
                  <p class="dot-caption"><i></i>Index</p>
                  <ol>
                    <li v-for="chapter in chapters" :key="chapter.key">
                      <button type="button" class="index-link" @click="goTo(chapter.key)">
                        <span class="tabular-nums">{{ chapter.index }}</span>{{ chapter.title }}
                        <span class="index-count tabular-nums">({{ pad(chapter.articles.length) }})</span>
                      </button>
                    </li>
                  </ol>
                </div>
              </div>
              <p class="hero-hint dot-caption">Scroll to explore</p>
            </section>

            <!-- ── 各分類（章節） ── -->
            <section
              v-for="(chapter, ci) in chapters"
              :key="chapter.key"
              :ref="(el) => (chapterEls[ci] = el as HTMLElement)"
              class="chapter"
              :aria-labelledby="`chapter-${chapter.key}`"
            >
              <!-- 標題列：左格標題與簡介、右格線條圖示 -->
              <header class="ch-head p-line grid border-b-[0.5px]">
                <div class="ch-head-main flex flex-col">
                  <p class="dot-caption"><i></i>Chapter {{ chapter.index }}</p>
                  <h2
                    :id="`chapter-${chapter.key}`"
                    :ref="(el) => (titleEls[ci] = el as HTMLElement)"
                    class="ch-title"
                  >
                    <span class="sr-only">{{ chapter.title }}</span>
                    <span aria-hidden="true" v-html="titleScrambles[ci]!.output.value || '&nbsp;'"></span>
                  </h2>
                  <p class="ch-intro">{{ chapter.intro }}</p>
                </div>
                <div class="ch-head-side p-line hidden flex-col items-center justify-center md:flex md:border-l-[0.5px]">
                  <svg class="ch-icon" viewBox="0 0 120 120" fill="none" stroke="currentColor" aria-hidden="true">
                    <circle class="ch-icon-orbit" cx="60" cy="60" r="57" stroke-dasharray="2 6" />
                    <circle cx="60" cy="60" r="46" />
                    <g v-if="chapter.icon === 'code'">
                      <path d="M46 46 32 60l14 14M74 46l14 14-14 14M66 38 54 82" />
                    </g>
                    <g v-else-if="chapter.icon === 'wave'">
                      <path d="M24 60c6-16 12-16 18 0s12 16 18 0 12-16 18 0 12 16 18 0" />
                      <path d="M24 60h72" stroke-dasharray="2 4" opacity="0.5" />
                    </g>
                    <g v-else-if="chapter.icon === 'frame'">
                      <path d="M36 42h40l8 8v30H54l-6-6H36Z" />
                      <path d="M44 52h24M44 60h32M44 68h16" opacity="0.6" />
                    </g>
                    <g v-else>
                      <path d="M32 84c14-6 18-18 28-24s18-6 28-22" stroke-dasharray="3 5" />
                      <circle cx="32" cy="84" r="3" />
                      <circle cx="88" cy="38" r="3" />
                    </g>
                  </svg>
                  <p class="dot-caption mt-6"><i></i>{{ pad(chapter.articles.length) }} articles</p>
                </div>
              </header>

              <!-- 文章列表：右半部 -->
              <div class="ch-list grid">
                <ol class="ch-items p-line md:border-l-[0.5px]">
                  <li v-for="article in chapter.articles" :key="article.title" class="ch-item p-line border-b-[0.5px]">
                    <p class="item-meta">
                      <span class="item-status" :class="`is-${article.status}`" aria-hidden="true"><i></i><i></i><i></i></span>
                      {{ STATUS_LABEL[article.status] }} · {{ article.date
                      }}<template v-if="article.readTime"> · {{ article.readTime }}</template>
                    </p>
                    <h3 class="item-title">
                      <NuxtLink v-if="article.link" :to="article.link" class="item-title-link">{{ article.title }}</NuxtLink>
                      <template v-else>{{ article.title }}</template>
                    </h3>
                    <p class="item-excerpt">{{ article.excerpt }}</p>
                    <NuxtLink v-if="article.link" :to="article.link" class="item-link link-hover" data-cursor="Read"
                      ><span>Read article →</span></NuxtLink
                    >
                    <p v-else class="item-soon">Coming soon</p>
                  </li>
                </ol>
              </div>

              <!-- 底列：斜線格 / 標籤 / 補充說明（三格不等寬） -->
              <footer class="ch-foot p-line grid border-b-[0.5px]">
                <div class="ch-foot-diag hidden md:block" aria-hidden="true">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor">
                    <line x1="0" y1="100" x2="100" y2="0" vector-effect="non-scaling-stroke" />
                  </svg>
                </div>
                <div class="ch-foot-tags p-line md:border-l-[0.5px]">
                  <p class="dot-caption"><i></i>Topics</p>
                  <ul>
                    <li v-for="tag in chapter.tags" :key="tag">{{ tag }}</li>
                  </ul>
                </div>
                <div class="ch-foot-note p-line border-t-[0.5px] md:border-t-0 md:border-l-[0.5px]">
                  <h3 class="note-heading">{{ chapter.note.heading }}</h3>
                  <p class="note-text">{{ chapter.note.text }}</p>
                </div>
              </footer>
            </section>

            <!-- ── 結尾 ── -->
            <section class="outro flex flex-col justify-between">
              <p class="dot-caption"><i></i>End of index</p>
              <div>
                <h2 class="outro-title">{{ OUTRO.title }}</h2>
                <p class="outro-text">{{ OUTRO.text }}</p>
              </div>
              <div class="flex items-center justify-between gap-4">
                <NuxtLink to="/gallery" class="link-hover"><span>Gallery →</span></NuxtLink>
                <button type="button" class="link-hover" @click="goTo('intro')"><span>Back to top ↑</span></button>
              </div>
            </section>
          </div>
        </main>
      </PanelShell>
    </div>

    <!-- 製造捲動距離（依內容高度改寫） -->
    <section ref="spacer" class="pointer-events-none relative z-10 h-[300vh]"></section>
  </div>
</template>

<style lang="scss" scoped>
  .articles {
    text-shadow: 0 1px 14px rgb(0 0 0 / 0.35);
  }

  .flow {
    position: relative;
    will-change: transform;
  }

  .p-line {
    border-color: var(--panel-line);
  }

  .dot-caption {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.85;

    i {
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  /* 共用的格內距 */
  .hero,
  .ch-head-main,
  .ch-head-side,
  .ch-item,
  .ch-foot > div,
  .outro {
    padding: 20px 16px;

    @media (min-width: 768px) {
      padding: 32px 40px;
    }
  }

  /* ── 開頭 ── */
  .hero {
    min-height: var(--view-h, 80vh);
  }

  .hero-title {
    min-height: 0.9em;
    font-size: clamp(64px, 15vw, 260px);
    font-weight: 700;
    line-height: 0.85;
    letter-spacing: -0.02em;
    text-align: center;
    text-transform: uppercase;
  }

  .hero-meta {
    margin-top: 18px;
  }

  /* 桌機：簡介與目錄都放右半部（左側為照片） */
  .hero-intro {
    max-width: 26rem;
    font-size: 14px;
    line-height: 1.6;
  }

  .hero-index {
    width: min(22rem, 30%);

    ol {
      margin-top: 12px;
      border-top: 0.5px solid var(--panel-line);
    }

    li {
      border-bottom: 0.5px solid var(--panel-line);
    }
  }

  .index-link {
    display: flex;
    gap: 14px;
    width: 100%;
    padding: 9px 0;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.3s;

    &:hover {
      opacity: 0.6;
    }
  }

  .index-count {
    margin-left: auto;
    opacity: 0.5;
  }

  .hero-hint {
    align-self: center;
    margin-top: 24px;
    opacity: 0.6;
  }

  /* ── 章節標題列：左格（標題）＋右格 26%（圖示） ── */
  .ch-head {
    grid-template-columns: 1fr;

    @media (min-width: 768px) {
      grid-template-columns: 1fr 26%;
      min-height: min(70vh, 620px);
    }
  }

  .ch-title {
    min-height: 0.9em;
    margin-top: 14px;
    font-size: clamp(48px, 8vw, 140px);
    font-weight: 700;
    line-height: 0.9;
    letter-spacing: -0.02em;
    text-transform: uppercase;
  }

  /* 桌機：簡介靠標題格右下（落在右半部的暗底上，不壓在左側照片的人物上） */
  .ch-intro {
    max-width: 32rem;
    margin-top: 24px;
    font-size: 14px;
    line-height: 1.6;

    @media (min-width: 768px) {
      align-self: flex-end;
      width: min(32rem, 60%);
      margin-top: auto;
      padding-top: 40px;
    }
  }

  .ch-icon {
    width: min(60%, 220px);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .ch-icon-orbit {
    transform-origin: 60px 60px;
    animation: orbit 30s linear infinite;
  }

  @keyframes orbit {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── 文章列表：桌機只佔右半部 ── */
  .ch-list {
    grid-template-columns: 1fr;

    @media (min-width: 768px) {
      grid-template-columns: 50% 50%;

      .ch-items {
        grid-column: 2;
      }
    }
  }

  .ch-item {
    &:last-child {
      border-bottom: 0;
    }
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
  }

  /* 狀態方塊（同 Protocol 頁的 ■■■）：已發佈三格全亮、撰寫中兩格、規劃中一格 */
  .item-status {
    display: inline-flex;
    gap: 3px;

    i {
      width: 5px;
      height: 5px;
      border: 0.5px solid currentColor;
    }

    &.is-published i,
    &.is-draft i:nth-child(-n + 2),
    &.is-planned i:first-child {
      background: currentColor;
    }
  }

  .item-title {
    max-width: 34rem;
    margin-top: 14px;
    font-size: clamp(22px, 2.2vw, 32px);
    font-weight: 700;
    line-height: 1.15;
  }

  .item-title-link {
    background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
    transition: background-size 0.4s cubic-bezier(0.22, 1, 0.36, 1);

    &:hover {
      background-size: 100% 1px;
    }
  }

  .item-excerpt {
    max-width: 34rem;
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.6;
    opacity: 0.85;
  }

  .item-link,
  .item-soon {
    display: inline-block;
    margin-top: 16px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .item-soon {
    opacity: 0.5;
  }

  /* ── 章節底列：26% / 24% / 50%（直線與上方各格的分界對齊：26% 與標題列右格、50% 與文章列表） ── */
  .ch-foot {
    grid-template-columns: 1fr;

    @media (min-width: 768px) {
      grid-template-columns: 26% 24% 50%;
      border-top: 0.5px solid var(--panel-line);
      min-height: 220px;
    }
  }

  .ch-foot-diag {
    position: relative;
    padding: 0 !important;

    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      stroke: var(--panel-line);
    }
  }

  .ch-foot-tags ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 14px;

    li {
      padding: 4px 10px;
      border: 0.5px solid var(--panel-line);
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.04em;
    }
  }

  .note-heading {
    font-size: 18px;
    font-weight: 700;
  }

  .note-text {
    max-width: 30rem;
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.6;
    opacity: 0.85;
  }

  /* ── 結尾 ── */
  .outro {
    gap: 40px;
    min-height: var(--view-h, 80vh);
  }

  .outro-title {
    font-size: clamp(48px, 9vw, 160px);
    font-weight: 700;
    line-height: 0.9;
    letter-spacing: -0.02em;
    text-transform: uppercase;
  }

  .outro-text {
    max-width: 28rem;
    margin-top: 20px;
    font-size: 14px;
    line-height: 1.6;
  }

  /* 文字連結：hover 時白底由左往右刷入、文字反黑（同側選單） */
  .link-hover {
    position: relative;
    padding: 2px 4px;
    margin-left: -4px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;

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
      text-shadow: none;

      &::before {
        transform: scaleX(1);
      }
    }
  }

  :deep(.scramble-dud) {
    opacity: 0.6;
  }

  @media (prefers-reduced-motion: reduce) {
    .ch-icon-orbit {
      animation: none;
    }
  }
</style>
