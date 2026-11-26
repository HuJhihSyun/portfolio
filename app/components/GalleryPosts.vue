<script setup lang="ts">
  import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import type { GalleryItem } from '#shared/gallery'
  import { SOCIAL_LINKS } from '#shared/profile'

  /**
   * GalleryPosts：Gallery 頁的 Instagram 貼文區，整段由頁面捲動驅動（同首頁，捲動補間由 gallery.vue 的主 timeline 透過 addTo() 接入）。
   * 1. 瀏覽：卡片排成摩天輪式大圓弧（參考 tatap.jp Service），捲動時輪盤連續轉動，停下時吸附到最近一張
   * 2. 收合：所有卡片聚攏成一疊、上方資訊與操作列退場（以下參考 kprverse「10,000 unique digital collectibles」之後的段落）
   * 3. 翻牌：整疊卡片轉成側面（一條細線），翻過來後浮現三張圖
   * 4. 展開：三張圖散開，中間那張擴展成滿版大圖，下方浮現說明文字
   * 三張圖是同一張大圖的三個「窗口」（滿版圖層以 clip-path 裁出），中間那張展開時畫面自然銜接成整張圖。
   */

  const props = defineProps<{
    items: GalleryItem[]
    entered: boolean // 開場 loading 結束後才播進場
  }>()

  const emit = defineEmits<{
    seek: [time: number] // 請父層捲到主 timeline 的這個時間點（點擊兩側卡片、上一張 / 下一張）
  }>()

  // 輪盤幾何：圓心在卡片下方約 14 個卡片高的位置（transform-origin 1450% = 卡片頂端往下 14.5 倍高）。
  // 卡片寬高比固定（4:5），間距與半徑都跟卡片高成比例，每格角度（CSS 變數 --step）因此是常數：
  // 桌機 4° → 相鄰卡片中心距 ≈ 1.22 倍卡片寬；行動版 3° → 約 0.92 倍，兩側卡片會露出一角。
  // 每張卡片的角度 = (i − --pos) × --step × --spread：--pos 為輪盤位置（捲動補間），--spread 由 1 → 0 時全部聚攏
  const ORIGIN = '50% 1450%'

  const META = {
    title: 'Moments between the beats.',
    desc: 'Snapshots from daily life — breaking sessions, city walks and the design experiments behind this site.',
    word: 'POSTS',
    source: 'Instagram',
    tag: 'IG'
  }

  // 展開後的大圖與說明（假資料，之後替換）
  const SCENE = {
    image: 'https://picsum.photos/seed/syun-scene/1920/1200',
    index: '002',
    label: 'Behind the lens',
    text: 'Every frame starts as a feeling — a move, a street corner, a line of code worth keeping. This is where the stories behind the posts live.'
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

  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')
  // 最新一則貼文的日期（API 依時間新到舊排列，仍取最大值以防順序不同）
  const latest = computed(() => {
    const dates = items.value.map((item) => item.date).sort()
    return dates.length ? fmtDate(dates[dates.length - 1]!) : '—'
  })

  // 內文：貼文的第一行已作為標題，其餘行放在卡片內文；
  // 亂碼效果以 v-html 輸出，先把 < > & 換成外觀相近的全形字元，避免內文被當成 HTML
  const safe = (text: string) => text.replace(/[<>&]/g, (c) => ({ '<': '‹', '>': '›', '&': '＆' })[c]!)
  const bodyText = (item: GalleryItem | undefined) =>
    item ? safe(item.caption.split('\n').slice(1).join('\n').trim()) : ''

  const { output: titleOut, setText: setTitle } = useTextScramble({ duration: 24 })
  const { output: descOut, setText: setDesc } = useTextScramble({ duration: 30 })
  const { output: captionOut, setText: setCaption } = useTextScramble({ duration: 22 })
  const { output: sceneOut, setText: setScene } = useTextScramble({ duration: 30 })

  const band = ref<HTMLElement | null>(null)
  const bgWrap = ref<HTMLElement | null>(null)
  const bgWord = ref<HTMLElement | null>(null)
  const guides = ref<HTMLElement | null>(null)
  const wheelFlip = ref<HTMLElement | null>(null)
  const wheel = ref<HTMLElement | null>(null)
  const barWrap = ref<HTMLElement | null>(null)
  const tileEls = ref<HTMLElement[]>([])
  const sceneImg = ref<HTMLElement | null>(null)
  const sceneShade = ref<HTMLElement | null>(null)
  const sceneCaption = ref<HTMLElement | null>(null)

  let reduceMotion = false

  // ── 進場（時間驅動，loading 結束後播一次）：標題解碼、輪盤由右側轉入 ──
  let introDone = false
  const intro = () => {
    if (introDone || !wheel.value) return
    introDone = true
    setTitle(META.title)
    setDesc(META.desc)
    gsap.to(bgWord.value, { autoAlpha: 1, duration: reduceMotion ? 0 : 1.2 })
    gsap.fromTo(
      wheel.value,
      { rotation: 16, autoAlpha: 0 },
      { rotation: 0, autoAlpha: 1, duration: reduceMotion ? 0 : 1.6, ease: 'expo.out', transformOrigin: ORIGIN }
    )
    setTimeout(
      () => {
        setCaption(bodyText(current.value))
        videoAllowed = true
        syncVideos()
      },
      reduceMotion ? 0 : 700
    )
  }

  watch(
    () => props.entered,
    (value) => value && intro()
  )

  // ── 捲動段落 ──
  // 時間單位同主 timeline（1 單位 = gallery.vue 的 VH_PER_UNIT 捲動距離）
  const BROWSE_HOLD = 0.3 // 一開始先停留一小段才開始轉
  const CARD = 0.5 // 每轉一張卡片的長度
  const COLLAPSE = 1.2 // 卡片聚攏、上方資訊退場
  const FLIP_OUT = 0.5 // 整疊轉成側面
  const FLIP_IN = 0.7 // 三張圖翻出
  const SPREAD = 1 // 三張圖散開
  const EXPAND = 1.3 // 中間那張擴展成滿版
  const CAPTION = 0.5 // 說明文字浮現

  // 三張圖的位置與大小（視窗的 %，場景為全螢幕圖層）：compact = 剛翻出時聚在輪盤中央；spread = 散開；FULL = 全螢幕
  // 順序：左上直式、右下小張、主圖（最後一張在最上層，會展開成全螢幕）
  type Rect = { x: number; y: number; w: number; h: number }
  const LAYOUTS: Record<'desktop' | 'mobile', Record<'compact' | 'spread', Rect[]>> = {
    desktop: {
      compact: [
        { x: 29, y: 36, w: 8.5, h: 34 },
        { x: 56, y: 72, w: 12, h: 16 },
        { x: 38, y: 40, w: 20, h: 40 }
      ],
      spread: [
        { x: 7, y: 12, w: 15, h: 50 },
        { x: 67, y: 66, w: 22, h: 24 },
        { x: 31, y: 24, w: 34, h: 58 }
      ]
    },
    mobile: {
      compact: [
        { x: 6, y: 44, w: 18, h: 20 },
        { x: 52, y: 76, w: 30, h: 11 },
        { x: 20, y: 50, w: 48, h: 27 }
      ],
      spread: [
        { x: 6, y: 9, w: 40, h: 19 },
        { x: 40, y: 77, w: 50, h: 14 },
        { x: 9, y: 32, w: 76, h: 38 }
      ]
    }
  }
  const FULL: Rect = { x: 0, y: 0, w: 100, h: 100 }
  // 位置以 CSS 變數表示（gsap 補間數字，圖框與框內圖片的對齊都由 CSS 計算，不依賴補間回呼）
  const vars = ({ x, y, w, h }: Rect) => ({ '--x': x, '--y': y, '--w': w, '--h': h })

  // 三張圖的外框角型（同首頁 TechFrame 語彙，外側為圓角，三張各不相同）；
  // 主圖沿用首頁第二幕主視覺的組合，展開成全螢幕時角的大小隨 mainCorner（1 → 0）收回成直角
  const TILE_CORNERS: Corners[] = [
    {
      topLeft: { type: 'round', size: 18 },
      topRight: { type: 'bevel', size: 28 },
      bottomRight: { type: 'round', size: 18 },
      bottomLeft: { type: 'round', size: 18 }
    },
    {
      topLeft: { type: 'round', size: 14 },
      topRight: { type: 'round', size: 14 },
      bottomRight: { type: 'bevel', size: 22 },
      bottomLeft: { type: 'notch', size: '38%', depth: 12, radius: 8 }
    }
  ]
  const MAIN_CORNERS: Corners = {
    topLeft: { type: 'round', size: 18 },
    topRight: { type: 'bevel', size: 34 },
    bottomRight: { type: 'round', size: 18 },
    bottomLeft: { type: 'notch', size: 72, depth: 22, radius: 10 }
  }
  const mainCorner = ref(1)
  const scaleCorner = (corner: Corner, k: number): Corner => ({
    ...corner,
    size: typeof corner.size === 'number' ? corner.size * k : corner.size,
    depth: corner.depth !== undefined ? corner.depth * k : undefined,
    radius: corner.radius !== undefined ? corner.radius * k : undefined
  })
  const tileCorners = computed<Corners[]>(() => {
    const k = mainCorner.value
    return [
      ...TILE_CORNERS,
      {
        topLeft: scaleCorner(MAIN_CORNERS.topLeft, k),
        topRight: scaleCorner(MAIN_CORNERS.topRight, k),
        bottomRight: scaleCorner(MAIN_CORNERS.bottomRight, k),
        bottomLeft: scaleCorner(MAIN_CORNERS.bottomLeft, k)
      }
    ]
  })

  // 各段落的起點（addTo 時算出），供捲動同步與吸附使用
  let browseAt = 0
  let sceneCaptionAt = Infinity
  let collapseStart = Infinity // 卡片開始收合的時間點：之後停止播放影片

  const posAt = (time: number) => gsap.utils.clamp(0, Math.max(0, total.value - 1), (time - browseAt) / CARD)
  const timeOfCard = (index: number) => browseAt + gsap.utils.clamp(0, total.value - 1, index) * CARD

  /** 把各段落排進主 timeline（從目前長度往後接），回傳瀏覽段的範圍供父層吸附卡片 */
  const addTo = (tl: gsap.core.Timeline, isMobile: boolean) => {
    const layout = LAYOUTS[isMobile ? 'mobile' : 'desktop']
    const last = Math.max(0, total.value - 1)
    const start = tl.duration()

    browseAt = start + BROWSE_HOLD
    const browseEnd = browseAt + last * CARD
    const collapseAt = browseEnd + 0.4
    collapseStart = collapseAt
    const flipOutAt = collapseAt + COLLAPSE
    const flipInAt = flipOutAt + FLIP_OUT
    const spreadAt = flipInAt + FLIP_IN
    const expandAt = spreadAt + SPREAD
    sceneCaptionAt = expandAt + EXPAND
    const tiles = tileEls.value

    // 三張圖的起始狀態先套好（聚在中央、轉成側面），翻牌那一刻才顯示，避免顯示的瞬間還沒套上位置 / 角度。
    // 寫在主 timeline 的起點（而非 gsap.set）：ScrollTrigger 重新量測時會還原 / 重播 timeline，狀態才不會被清掉
    tiles.forEach((tile, i) =>
      tl.set(tile, { ...vars(layout.compact[i]!), rotationY: -90, transformPerspective: 1400 }, 0)
    )

    tl
      // 1. 瀏覽：輪盤位置隨捲動連續轉動，背景大字反向平移
      .fromTo(wheel.value, { '--pos': 0 }, { '--pos': last, duration: last * CARD }, browseAt)
      .fromTo(bgWord.value, { xPercent: 0 }, { xPercent: -last * 1.6, duration: last * CARD }, browseAt)

      // 2. 收合：卡片聚攏到中央那張、上方兩格往上退場、背景字 / 中線 / 操作列淡出
      .fromTo(wheel.value, { '--spread': 1 }, { '--spread': 0, duration: COLLAPSE, ease: 'power3.inOut' }, collapseAt)
      .fromTo(
        band.value,
        { yPercent: 0, autoAlpha: 1 },
        { yPercent: -100, autoAlpha: 0, duration: COLLAPSE * 0.8, ease: 'power2.in' },
        collapseAt
      )
      .fromTo(
        [bgWrap.value, guides.value, barWrap.value],
        { autoAlpha: 1 },
        { autoAlpha: 0, duration: COLLAPSE * 0.6 },
        collapseAt
      )

      // 3. 翻牌：整疊轉成側面（一條細線）→ 三張圖從另一側翻出
      .fromTo(
        wheelFlip.value,
        { rotationY: 0 },
        { rotationY: 90, duration: FLIP_OUT, ease: 'power2.in', transformPerspective: 1200 },
        flipOutAt
      )
      .fromTo(wheelFlip.value, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01 }, flipInAt)

    tiles.forEach((tile, i) => {
      const compact = layout.compact[i]!
      const spread = layout.spread[i]!
      const isMain = i === tiles.length - 1
      tl.fromTo(tile, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, flipInAt)
        .fromTo(
          tile,
          { rotationY: -90 },
          { rotationY: 0, duration: FLIP_IN, ease: 'power2.out', immediateRender: false },
          flipInAt + i * 0.08
        )
        // 4. 散開：移到各自的位置並放大
        .fromTo(
          tile,
          vars(compact),
          { ...vars(spread), duration: SPREAD, ease: 'power2.inOut', immediateRender: false },
          spreadAt
        )
      if (isMain) {
        // 5. 主圖擴展成全螢幕（墊在 Panel 後面，同首頁的大圖），外框角同步收回成直角
        tl.fromTo(
          tile,
          vars(spread),
          { ...vars(FULL), duration: EXPAND, ease: 'power3.inOut', immediateRender: false },
          expandAt
        ).fromTo(mainCorner, { value: 1 }, { value: 0, duration: EXPAND, ease: 'power3.inOut' }, expandAt)
      } else {
        // 兩側的圖往外飄開並淡出，讓位給主圖
        const away = { ...spread, x: spread.x + (i === 0 ? -10 : 10), y: spread.y + (i === 0 ? -6 : 6) }
        tl.fromTo(
          tile,
          { ...vars(spread), autoAlpha: 1 },
          { ...vars(away), autoAlpha: 0, duration: EXPAND * 0.8, ease: 'power2.in', immediateRender: false },
          expandAt
        )
      }
    })

    tl
      // 主圖展開時圖片同時微微拉遠（1.15 → 1），增加景深；下方壓暗供說明文字閱讀
      .fromTo(sceneImg.value, { scale: 1.15 }, { scale: 1, duration: SPREAD + EXPAND, ease: 'power2.out' }, spreadAt)
      .fromTo(sceneShade.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: EXPAND * 0.6 }, expandAt + EXPAND * 0.4)
      // 6. 說明文字浮現
      .fromTo(
        sceneCaption.value,
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: CAPTION, ease: 'power2.out' },
        sceneCaptionAt
      )

    return { browseAt, browseEnd, cardDur: CARD, count: total.value }
  }

  // 捲動時由父層呼叫：依時間推算目前卡片（純計算，不依賴補間的回呼）、切換說明文字的解碼
  let sceneShown = false
  // ── 影片自動播放：只播放中央那張（瀏覽段落、進場後），其餘暫停；偏好減少動態效果時不自動播放 ──
  const videoEls: (HTMLVideoElement | null)[] = []
  let videoAllowed = false
  const syncVideos = () => {
    videoEls.forEach((video, i) => {
      if (!video) return
      if (videoAllowed && !reduceMotion && i === active.value) {
        if (video.paused) video.play().catch(() => {}) // 瀏覽器拒絕自動播放時保留封面
      } else if (!video.paused) {
        video.pause()
      }
    })
  }

  const onScroll = (time: number) => {
    const index = Math.round(posAt(time))
    const allowed = introDone && time < collapseStart
    if (index !== active.value || allowed !== videoAllowed) {
      if (index !== active.value) setCaption(bodyText(items.value[index]))
      active.value = index
      videoAllowed = allowed
      syncVideos()
    }
    const showScene = time >= sceneCaptionAt
    if (showScene !== sceneShown) {
      sceneShown = showScene
      setScene(showScene ? SCENE.text : '')
    }
  }

  // 點擊卡片：兩側卡片 → 捲到該張；中央卡片 → 照常開啟連結
  const onCardClick = (e: MouseEvent, index: number) => {
    if (index === active.value) return
    e.preventDefault()
    emit('seek', timeOfCard(index))
  }
  const step = (dir: number) => emit('seek', timeOfCard(active.value + dir))

  // 鍵盤左右鍵：上一張 / 下一張（上下鍵保留瀏覽器原本的捲動）
  const onKeydown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="dialog"]')) return
    const sideMenu = document.querySelector<HTMLElement>('.side-menu')
    if (sideMenu && getComputedStyle(sideMenu).display !== 'none') return
    if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowLeft') step(-1)
    else return
    e.preventDefault()
  }

  onMounted(() => {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.addEventListener('keydown', onKeydown)
    if (props.entered) intro()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    gsap.killTweensOf([wheel.value, bgWord.value])
  })

  defineExpose({ addTo, onScroll })
</script>

<template>
  <main class="gallery relative flex h-full w-full flex-col overflow-clip" :class="{ 'is-entered': entered }">
    <!-- 上半部：兩格資訊（參考 kprverse「10,000 unique digital collectibles」區塊的版面）。
         左格：編號＋大標題；右格：帳號、說明與數據。兩格的分隔線位於正中，往下延伸成輪盤的中線 -->
    <header ref="band" class="band p-line relative z-10 grid shrink-0 border-b-[0.5px] md:grid-cols-2">
      <div class="band-cell relative">
        <p class="dot-caption band-index"><i></i>001</p>
        <!-- 完整原文（視覺隱藏）供搜尋引擎讀取，亂碼動畫標為 aria-hidden（同首頁 Panel） -->
        <h1 class="head-title">
          <span class="sr-only">{{ META.title }}</span>
          <span aria-hidden="true" v-html="titleOut"></span>
        </h1>
      </div>
      <div class="band-cell band-side p-line md:border-l-[0.5px]">
        <p class="dot-caption band-label"><i></i>Instagram</p>
        <div class="min-w-0">
          <p class="head-desc">
            <span class="sr-only">{{ META.desc }}</span>
            <span aria-hidden="true" v-html="descOut"></span>
          </p>
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
      <div ref="bgWrap" class="bg-wrap pointer-events-none absolute inset-x-0" aria-hidden="true">
        <div ref="bgWord" class="bg-word invisible">{{ `${META.word} — `.repeat(8) }}</div>
      </div>
      <!-- 中線＋上下三角標記：延續上方兩格的分隔線，標示輪盤的中心位置 -->
      <div ref="guides" class="pointer-events-none absolute inset-0" aria-hidden="true">
        <span class="guide"></span>
        <span class="guide-mark is-top"></span>
        <span class="guide-mark is-bottom"></span>
      </div>
      <!-- 外層負責翻牌（以卡片中心為軸 rotateY），內層負責進場時繞輪盤圓心轉入 -->
      <div ref="wheelFlip" class="wheel-box">
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
                <!-- 影片貼文：靜音循環的影片（封面為縮圖），卡片轉到中央才載入並播放 -->
                <video
                  v-if="item.video"
                  :ref="(el) => (videoEls[i] = el as HTMLVideoElement | null)"
                  :src="item.video"
                  :poster="item.image"
                  class="card-img"
                  muted
                  loop
                  playsinline
                  preload="none"
                  disablepictureinpicture
                  :aria-label="item.title"
                ></video>
                <img v-else :src="item.image" :alt="item.title" class="card-img" loading="lazy" draggable="false" />
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
                <!-- 每則貼文的內文都輸出一份（視覺隱藏）供搜尋引擎讀取；畫面上只有目前卡片播放亂碼解碼 -->
                <p class="sr-only">{{ bodyText(item) }}</p>
                <p v-if="i === active" class="card-caption" aria-hidden="true" v-html="captionOut"></p>
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
    </div>

    <!-- 收合後的翻牌 / 展開場景：全螢幕固定圖層，傳送到 body 層、墊在 Panel 之後（同首頁的大圖）。
         三張圖是同一張大圖的三個窗口：圖框以 TechFrame 裁出外形，框內圖片依圖框位置反向偏移、維持全螢幕對齊，
         主圖展開成全螢幕時畫面自然銜接成整張圖 -->
    <Teleport to="#teleports">
      <div class="gallery-scene pointer-events-none fixed inset-0 z-[5]" aria-hidden="true">
        <div
          v-for="(corners, i) in tileCorners"
          :key="i"
          :ref="(el) => (tileEls[i] = el as HTMLElement)"
          class="tile invisible absolute"
        >
          <TechFrame :stroke-width="0" v-bind="corners" class="h-full w-full">
            <img
              :ref="i === tileCorners.length - 1 ? (el) => (sceneImg = el as HTMLElement) : undefined"
              :src="SCENE.image"
              alt=""
              class="tile-img"
              loading="lazy"
            />
          </TechFrame>
        </div>
        <!-- 主圖展開後：壓暗（上方讓 Panel 頂列可讀、下方給說明文字）＋說明文字 -->
        <span ref="sceneShade" class="scene-shade invisible absolute inset-0"></span>
        <div
          ref="sceneCaption"
          class="scene-caption invisible absolute inset-x-0 bottom-0 px-10 pb-10 text-center text-white md:pb-16"
        >
          <p class="dot-caption justify-center">{{ SCENE.index }} <i></i> {{ SCENE.label }}</p>
          <p class="scene-text">
            <span class="sr-only">{{ SCENE.text }}</span>
            <span aria-hidden="true" v-html="sceneOut"></span>
          </p>
        </div>
      </div>
    </Teleport>

    <!-- 底部操作列：上一張 / 序號 / 下一張、操作提示、原始連結 -->
    <div ref="barWrap" class="relative z-10 shrink-0">
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
        <span class="hidden md:block opacity-50 tracking-wider">SCROLL · ← → TO EXPLORE</span>
        <a
          v-if="current"
          :href="current.link"
          target="_blank"
          rel="noopener noreferrer"
          class="link-hover whitespace-nowrap"
          ><span><span class="max-md:hidden">View on </span>{{ META.source }} ↗</span></a
        >
      </div>
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

  .wheel-box {
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
  /* 內層：與卡片同大小、疊在同一位置；--pos / --spread 由捲動補間，子層卡片繼承 */
  .wheel {
    position: absolute;
    inset: 0;
  }

  .card {
    position: absolute;
    inset: 0;
    transform: rotate(calc((var(--i) - var(--pos, 0)) * var(--step) * var(--spread, 1)));
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

  /* ── 翻牌 / 展開場景 ── */
  /* 圖框位置 / 大小由 CSS 變數（視窗的 %）決定，gsap 補間變數 */
  .tile {
    left: calc(var(--x, 0) * 1%);
    top: calc(var(--y, 0) * 1%);
    width: calc(var(--w, 100) * 1%);
    height: calc(var(--h, 100) * 1%);
    backface-visibility: hidden;
  }

  /* 框內圖片維持全螢幕大小並反向偏移，讓每個圖框都像是同一張大圖的窗口
     （選擇器加上 .tile 以蓋過 TechFrame 內建的 img 填滿樣式） */
  .tile .tile-img {
    position: absolute;
    left: calc(var(--x, 0) / var(--w, 100) * -100%);
    top: calc(var(--y, 0) / var(--h, 100) * -100%);
    width: calc(10000% / var(--w, 100));
    height: calc(10000% / var(--h, 100));
    max-width: none;
    object-fit: cover;
  }

  .scene-shade {
    background: linear-gradient(
      to top,
      rgb(0 0 0 / 0.75),
      rgb(0 0 0 / 0.2) 40%,
      rgb(0 0 0 / 0.15) 70%,
      rgb(0 0 0 / 0.45)
    );
  }

  .scene-caption {
    text-shadow: 0 1px 8px rgb(0 0 0 / 0.5);

    .dot-caption {
      display: flex;
      opacity: 0.85;
    }
  }

  .scene-text {
    min-height: 3em;
    max-width: 34rem;
    margin: 14px auto 0;
    font-size: clamp(15px, 1.6vw, 22px);
    line-height: 1.45;
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
