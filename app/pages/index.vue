<script lang="ts" setup>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'

  // 第一幕主視覺：桌機橫式 / 行動版直式各一張（以 <picture> 依斷點切換）
  import bannerPc from '@/assets/images/banner1-pc.webp'
  import bannerM from '@/assets/images/banner1-m.webp'
  // 主角去背圖（與原圖同尺寸，疊回去完全對齊）：夾住 WELCOME 文字，做出「字穿過人物」的前後景效果
  import bannerPcSubject from '@/assets/images/banner1-pc-subject.png'
  import bannerMSubject from '@/assets/images/banner1-m-subject.png'
  // 第三幕滿版背景：由原圖（1182×1330）拆成三層做景深視差
  // 背景層為原圖上下各延伸 200px（等比 1182×1730）並補畫被遮住的部分；主體 / 前景為原尺寸去背圖，疊回去與原圖對齊
  import stageBg from '@/assets/images/main-bg.webp'
  import stageSubject from '@/assets/images/main-subject.png'
  import stageFg from '@/assets/images/main-fg.png'

  gsap.registerPlugin(ScrollTrigger)

  const { tiltStyle } = useTilt({ max: 1, scale: 1.06 })

  const root = ref<HTMLElement | null>(null)
  const spacer = ref<HTMLElement | null>(null)
  const bgWrap = ref<HTMLElement | null>(null)
  const bgCard = ref<HTMLElement | null>(null)
  const bgFront = ref<HTMLElement | null>(null)
  const bgBack = ref<HTMLElement | null>(null)
  const bgShade = ref<HTMLElement | null>(null)
  const welcomeBack = ref<HTMLElement | null>(null) // 第一幕 WELCOME 背景字（主角背後）
  const welcomeFront = ref<HTMLElement | null>(null) // 第一幕 WELCOME 外框字（主角前方）
  const welcomeOn = ref(false) // 開場 loading 結束後播 WELCOME 進場
  const bgParallax = ref<HTMLElement | null>(null) // 第三幕分層場景（整體視差）
  const stageBgEl = ref<HTMLElement | null>(null) // 背景層（比場景慢）
  const stageFgEl = ref<HTMLElement | null>(null) // 前景層（比場景快並放大）
  const stageHud = ref<{ play: () => void; reset: () => void } | null>(null) // 第四層 HUD（線條 / 準星 / 座標 / 程式碼框）
  const endBg = ref<HTMLElement | null>(null) // 第五幕深色底
  const panelRef = ref<{
    enter: () => void
    setProgress: (progress: number) => void
    scrambleOut: () => void
    scrambleIn: () => void
    revealOut: () => void
    revealIn: () => void
    aboutIn: () => void
    aboutOut: () => void
    skills: {
      addTo: (tl: gsap.core.Timeline, at: number, isMobile?: boolean, unitPx?: number) => void
      addOutro: (tl: gsap.core.Timeline, holdAt: number, outAt: number, isMobile?: boolean) => void
      enter: () => void
      leave: () => void
    } | null
    works: {
      addTo: (tl: gsap.core.Timeline, at: number, scrollLen: number, isMobile?: boolean) => void
      addOutro: (tl: gsap.core.Timeline, at: number) => void
      enter: () => void
      leave: () => void
      slotRect: () => DOMRect
      ringSlotRect: () => DOMRect
    } | null
    ring: { play: () => void; pause: () => void; setInteractive: (value: boolean) => void } | null
    contact: {
      addTo: (tl: gsap.core.Timeline, at: number, unitPx?: number) => void
      enter: () => void
      leave: () => void
    } | null
    $refs: {
      headerText: HTMLElement
      characterWrap: HTMLElement
      characterCard: HTMLElement
      aboutWrap: HTMLElement
      bgSlot: HTMLElement
      mainEl: HTMLElement
      ringFloat: HTMLElement
      ringFade: HTMLElement
    }
  } | null>(null)

  // 主 timeline 的分段（timeline 時間單位；1 單位 = VH_PER_UNIT 的捲動距離，目前為 50vh）
  // 各幕「停留」為畫面不變、只消耗捲動距離的區段，讓使用者有時間閱讀；要調整節奏改這裡即可
  const INTRO_HOLD = 0.8 // 第一幕停留：開始捲動後先維持主視覺一小段，才進入轉場
  const ACT2_IN = 1.3 // 第一 → 二幕轉場：大圖縮成小圖、角色卡片翻入
  const ACT2_HOLD = 3 // 第二幕停留（約一個半畫面高的捲動距離），讓自我介紹有時間讀完
  const FLIP = 1.5 // 第二 → 三幕轉場：小圖立體翻轉 + 放大至滿版
  const ACT3_HOLD = 2.6 // 第三幕內容全部進場後的停留（背景持續視差位移）
  const FLIP2 = 1.5 // 第三 → 四幕轉場：滿版背景反向翻轉、縮成中央作品卡片
  const WORKS_SCROLL = 4.5 // 第四幕作品輪播：兩列卡片隨捲動往相反方向位移的長度
  const ACT4_HOLD = 0.8 // 第四幕輪播走完後的停留
  const ACT5_IN = 1.2 // 第四 → 五幕轉場：作品區退場、深色底升起、Panel 配色 黑 → 白
  const END_HOLD = 1.2 // 第五幕內容全部進場後的結尾停留（頁面終點）
  // 第三幕分層視差（位移量皆為畫框高的倍數）：場景整體上移，背景層落後、前景層超前，形成景深
  const PARALLAX_SHIFT = 0.3 // 場景整體上移量（場景至少為畫框高的 130%，最多可移 30%）
  const STAGE_BG_LAG = 0.12 // 背景層相對場景往下的量（= 移動得比較慢；背景上下各有約 20% 的延伸可用）
  const STAGE_FG_LEAD = 0.18 // 前景層相對場景再往上的量（= 移動得比較快）
  const STAGE_FG_SCALE = 1.08 // 前景層同時放大，像鏡頭往前推
  // 環狀文字飛到第五幕底部（參考 styleport 底部的立體圓環）
  const RING_FLY = 1.8 // 飛行長度：與第五幕轉場同時開始，稍晚於深色底完成
  const RING_END_SCALE = { desktop: 0.8, mobile: 1.5 } // 終點寬度 = 內容區寬 × 此倍數（行動版超出畫面兩側）
  const RING_END_TILT = -24 // 終點傾斜角（rotateX）：接近水平的低角度俯視，圓環壓成扁平的橢圓
  const RING_END_LAY = 90 // 終點時每個字倒下的角度：90 = 平躺在環面上，像印在地面的文字環，降低立體感
  const RING_ROLL = 1 // 飛行途中圓環翻滾的圈數（繞水平軸翻轉，取代單純平移）
  const RING_END_ALPHA = 0.1 // 終點透明度：淡化成墊在聯絡內容底下的點綴

  const ACT2 = INTRO_HOLD // 第二幕轉場起點
  const ACT3 = ACT2 + ACT2_IN + ACT2_HOLD // 第三幕轉場起點
  const FLIP_MID = ACT3 + FLIP / 2 // 翻到 90°（側面）的時間點：正反面在此切換
  const SKILLS = ACT3 + FLIP // 技能矩陣 / 時間軸進場起點
  // 第四 / 五幕轉場起點：前一幕內容長度依斷點不同（行動版含內容上移），於建立 timeline 時才算出
  let act4At = Infinity
  let act5At = Infinity
  let ringAt = Infinity // 環狀文字開始旋轉的時間點（桌機版第四幕出現時；行動版第五幕才出現）

  // 背景大圖的科技感切角進度（0=矩形 → 1=完整切角），由主 timeline 補間：第二幕長出、第三幕滿版時收回
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

  // Panel 主題色進度（0=白字 → 1=黑字），由主 timeline 補間：第二幕白→黑、第三幕蓋上滿版圖時黑→白。
  // 以 ref + computed 綁定 CSS 變數（而非 tween 的 onUpdate 回呼）：ScrollTrigger refresh 重新渲染時
  // 會略過回呼，用回呼同步會讓配色停在舊值；綁定響應式值則永遠與實際進度一致。
  const themeProgress = ref(0)
  const panelTheme = computed(() => {
    const fg = Math.round(255 * (1 - themeProgress.value)) // 前景：白(255) → 黑(0)
    const bg = 255 - fg // 背景：黑(0) → 白(255)
    return {
      '--panel-fg': `rgb(${fg} ${fg} ${fg})`,
      '--panel-bg': `rgb(${bg} ${bg} ${bg})`,
      '--panel-line': `rgb(${fg} ${fg} ${fg} / 0.5)` // 框線：前景色 50% 透明
    }
  })

  // 捲動門檻的開關狀態：依 timeline 時間推導各區塊「應有的狀態」，只在狀態改變時觸發一次。
  // （由狀態推導而非逐一比對門檻，快速來回捲過多個門檻時最終狀態仍正確）
  const gates: Record<string, boolean> = {}
  const syncGate = (key: string, active: boolean, onIn: () => void, onOut: () => void) => {
    if (!!gates[key] === active) return
    gates[key] = active
    if (active) onIn()
    else onOut()
  }

  // 依捲動位置（timeline 時間）處理以 class / 亂碼驅動、非 scrub 的進退場
  const updateGates = (time: number) => {
    const panel = panelRef.value
    if (!panel) return

    // 第一幕停留結束、開始轉場 → 左上亂碼解散、右下標題 line-reveal 退場；捲回第一幕 → 還原
    syncGate(
      'header',
      time > ACT2 + 0.02,
      () => (panel.scrambleOut(), panel.revealOut()),
      () => (panel.scrambleIn(), panel.revealIn())
    )
    // 右側 nameWrap Block Reveal + aboutText 解碼：只在第二幕期間顯示
    syncGate('about', time > ACT2 + 0.02 && time < ACT3 + 0.05, panel.aboutIn, panel.aboutOut)
    // 第三幕標題亂碼解碼：只在第三幕期間顯示
    syncGate(
      'skills',
      time > SKILLS && time < act4At + 0.05,
      () => panel.skills?.enter(),
      () => panel.skills?.leave()
    )
    // 第三幕 HUD：背面（第三幕背景）翻出後畫出線條、解碼文字；翻往第四幕到側面時收回
    syncGate(
      'hud',
      time > FLIP_MID + 0.15 && time < act4At + FLIP2 / 2,
      () => stageHud.value?.play(),
      () => stageHud.value?.reset()
    )
    // 第四幕作品標題亂碼解碼：背景翻到側面、切換成作品卡片後
    syncGate(
      'works',
      time > act4At + FLIP2 / 2 && time < act5At + 0.05,
      () => panel.works?.enter(),
      () => panel.works?.leave()
    )
    // 環狀文字：出現後持續旋轉到頁尾，捲回出現前才停轉（停轉時不佔用每幀運算）
    syncGate(
      'ring',
      time > ringAt,
      () => panel.ring?.play(),
      () => panel.ring?.pause()
    )
    // 環狀文字只在第四幕可點擊（捲到聯絡區）；飛到第五幕後當背景圖騰，不擋表單
    syncGate(
      'ringLink',
      time < act5At,
      () => panel.ring?.setInteractive(true),
      () => panel.ring?.setInteractive(false)
    )
    // 第五幕標題 / 終端機訊息解碼：深色底升起一半後
    syncGate(
      'contact',
      time > act5At + ACT5_IN / 2,
      () => panel.contact?.enter(),
      () => panel.contact?.leave()
    )

    // 依「實際渲染透明度」切換 display（讀當前值而非進度，避開 scrub 延遲殘影）：
    // 全透明後設 display:none 不再佔版面，回捲可見時還原成預設 display。
    const el = panel.$refs.headerText
    if (el) {
      const opacity = Number(gsap.getProperty(el, 'opacity'))
      el.style.display = opacity <= 0.01 ? 'none' : ''
    }
  }

  const { onLoaded } = useGlobalLoading() // 開場 loading 結束後才播進場、建立捲動動畫（站內換頁回首頁時立即開始）
  const VH_PER_UNIT = 50 // 每 1 單位 timeline 時間對應的捲動距離（vh），捲動空間依 timeline 總長換算
  let tl: gsap.core.Timeline | null = null
  let trigger: ScrollTrigger | null = null
  let mm: gsap.MatchMedia | null = null

  // 各區塊「內容完整進場」的 timeline 時間點：頂部選單點擊後捲到這裡（內容長度依斷點不同，於建立 timeline 時才算出）
  type SectionKey = 'about' | 'skills' | 'works' | 'contact'
  const sectionTimes: Partial<Record<SectionKey, number>> = {}

  // 頂部選單：把區塊的 timeline 時間換算成捲動位置後平滑捲過去（scrub 會順著播完沿途的轉場）
  const scrollToSection = (key: SectionKey) => {
    const time = sectionTimes[key]
    if (!tl || !trigger || time === undefined) return // 開場 loading 期間 timeline 尚未建立
    const top = trigger.start + (time / tl.duration()) * (trigger.end - trigger.start)
    window.scrollTo({ top, behavior: 'smooth' })
  }
  let cancelStart: (() => void) | null = null

  // 依斷點建立主 timeline（由 gsap.matchMedia 呼叫；跨越斷點時自動 revert 舊的並重建）
  const buildTimeline = (isMobile: boolean) => {
    const refs = panelRef.value?.$refs
    sectionTimes.about = ACT2 + ACT2_IN + 0.3 // 第二幕轉場完成後稍往前一點，讓名字 Block Reveal 與自我介紹解碼完整播出
    // 第二幕小圖落點（視窗座標）；以函式值傳給補間，搭配 invalidateOnRefresh 在視窗尺寸變更時重新量測
    const slotRect = () => refs!.bgSlot.getBoundingClientRect()

    // 所有動畫排在同一條主 timeline、由單一 ScrollTrigger 驅動。
    // 先排好補間、依總長設定捲動空間，最後才建立 ScrollTrigger（確保量測到正確的捲動範圍）
    // defaults.duration 只作用於未指定長度的第二幕轉場補間（其餘補間皆明確指定 duration）
    tl = gsap.timeline({
      defaults: { ease: 'none', duration: ACT2_IN },
      paused: true,
      // 右側直欄的頁面進度條：跟著 timeline（含 scrub 平滑）更新，與畫面上的轉場同步
      onUpdate: () => panelRef.value?.setProgress(tl?.progress() ?? 0)
    })

    // 注意：因 invalidateOnRefresh，視窗尺寸變更時補間會重新記錄起始值。
    // 若用 .to()，在捲動途中 resize 會把「當下的中間狀態」誤記為起點，回捲時就無法還原，
    // 因此各段的起始狀態一律以 fromTo 明確指定（第三幕的 fromTo 加 immediateRender:false，避免建立時就套用）。
    tl
      // ── 第一幕：WELCOME 前後景文字退場 ──
      // 一開始捲動就往上飄，外框字（前景）移得比實心字（背景）快，拉出前後景深；轉場開始時淡出，不帶進第二幕小圖
      .fromTo(welcomeBack.value, { yPercent: 0 }, { yPercent: -8, duration: ACT2 + 0.6 }, 0)
      .fromTo(welcomeFront.value, { yPercent: 0 }, { yPercent: -22, duration: ACT2 + 0.6 }, 0)
      .fromTo([welcomeBack.value, welcomeFront.value], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.6 }, ACT2 - 0.1)

      // ── 第二幕 ──
      // 背景大圖：由滿版縮成小圖，落點與尺寸取自 Panel 內的 bgSlot（由 CSS 決定各斷點的位置，RWD 自動對應）
      .fromTo(
        bgWrap.value,
        { width: () => window.innerWidth, height: () => window.innerHeight, left: 0, bottom: 0 },
        {
          width: () => slotRect().width,
          height: () => slotRect().height,
          left: () => slotRect().left,
          bottom: () => window.innerHeight - slotRect().bottom
        },
        ACT2
      )
      // 背景大圖長出科技感切角、Panel 配色 白 → 黑
      .fromTo(cornerProgress, { value: 0 }, { value: 1 }, ACT2)
      .fromTo(themeProgress, { value: 0 }, { value: 1 }, ACT2)
      // 左上 profile 文字：淡出
      .fromTo(refs?.headerText, { opacity: 1 }, { opacity: 0 }, ACT2)
      // 角色欄整體淡入
      .fromTo(refs?.characterWrap, { opacity: 0 }, { opacity: 1 }, ACT2)
      // 角色卡片：以中心為軸翻轉進入
      .fromTo(
        refs?.characterCard,
        { rotationY: -180, opacity: 0 },
        { rotationY: 0, opacity: 1, transformOrigin: 'center' },
        ACT2
      )
      .fromTo(refs?.aboutWrap, { opacity: 0 }, { opacity: 1 }, ACT2)

      // ── 第三幕：第二幕內容退場 ──
      // 角色卡片沿同方向繼續翻出、角色欄與右側區塊淡出
      .to(refs?.characterCard, { rotationY: 180, opacity: 0, duration: 0.6 }, ACT3)
      .to([refs?.characterWrap, refs?.aboutWrap], { opacity: 0, duration: 0.5 }, ACT3)

      // ── 第三幕：小圖立體翻轉 + 放大成滿版背景 ──
      .to(
        bgWrap.value,
        {
          width: () => window.innerWidth,
          height: () => window.innerHeight,
          left: 0,
          bottom: 0,
          duration: FLIP,
          ease: 'power2.inOut'
        },
        ACT3
      )
      .fromTo(
        bgCard.value,
        { rotationY: 0 },
        { rotationY: 180, duration: FLIP, ease: 'power2.inOut', immediateRender: false },
        ACT3
      )
      // 翻到側面（90°）的瞬間正反面互換：正面（小圖）隱藏、背面（第三幕背景）顯示
      .fromTo(bgFront.value, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0, immediateRender: false }, FLIP_MID)
      .fromTo(bgBack.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0, immediateRender: false }, FLIP_MID)
      // 後半段：切角收回成滿版矩形、Panel 配色 黑 → 白、背景壓暗讓文字可讀
      .fromTo(cornerProgress, { value: 1 }, { value: 0, duration: FLIP / 2, immediateRender: false }, FLIP_MID)
      .fromTo(themeProgress, { value: 1 }, { value: 0, duration: FLIP / 2, immediateRender: false }, FLIP_MID)
      .fromTo(bgShade.value, { opacity: 0 }, { opacity: 1, duration: FLIP / 2 }, FLIP_MID)

    // ── 第三幕：技能矩陣 + 時間軸進場（行動版另含內容上移，timeline 較長）──
    const panel = panelRef.value
    panel?.skills?.addTo(tl, SKILLS, isMobile, (window.innerHeight * VH_PER_UNIT) / 100)

    // 第三幕內容進場完畢 → 停留 → 第四幕轉場
    const act3End = tl.duration()
    // 第三幕落點：桌機版取內容全部進場的時間點；行動版內容進場後會再上移，改取上移前（技能矩陣完整顯示）
    sectionTimes.skills = isMobile ? SKILLS + 1.8 : act3End
    const ACT4 = act3End + ACT3_HOLD
    const FLIP2_MID = ACT4 + FLIP2 / 2 // 翻到 270°（側面）的時間點：背面（第三幕）切換成作品卡片
    act4At = ACT4
    panel?.skills?.addOutro(tl, act3End, ACT4, isMobile)

    // 第三幕分層視差：背面一出現就開始，直到翻轉到側面被換掉為止。
    // 場景整體緩慢上移；背景層落後、前景層超前並放大，三層速度不同形成景深（位移量以畫框高換算，resize 時重新量測）
    const frameH = () => bgBack.value?.clientHeight ?? window.innerHeight
    const stageLen = FLIP2_MID - FLIP_MID
    tl.fromTo(
      bgParallax.value,
      { y: 0 },
      { y: () => -frameH() * PARALLAX_SHIFT, duration: stageLen, immediateRender: false },
      FLIP_MID
    )
      .fromTo(
        stageBgEl.value,
        { y: 0 },
        { y: () => frameH() * STAGE_BG_LAG, duration: stageLen, immediateRender: false },
        FLIP_MID
      )
      .fromTo(
        stageFgEl.value,
        { y: 0, scale: 1 },
        { y: () => -frameH() * STAGE_FG_LEAD, scale: STAGE_FG_SCALE, duration: stageLen, immediateRender: false },
        FLIP_MID
      )

    // ── 第四幕：滿版背景沿同方向繼續翻轉（180° → 360°）並縮向中央輪播區，翻到側面時消失、由輪播接手 ──
    const workRect = () => panel!.works!.slotRect()
    tl.fromTo(
      bgWrap.value,
      { width: () => window.innerWidth, height: () => window.innerHeight, left: 0, bottom: 0 },
      {
        width: () => workRect().width,
        height: () => workRect().height,
        left: () => workRect().left,
        bottom: () => window.innerHeight - workRect().bottom,
        duration: FLIP2,
        ease: 'power2.inOut',
        immediateRender: false
      },
      ACT4
    )
      .fromTo(
        bgCard.value,
        { rotationY: 180 },
        { rotationY: 360, duration: FLIP2, ease: 'power2.inOut', immediateRender: false },
        ACT4
      )
      // 縮小時露出淺色底 → Panel 配色 白 → 黑；背景遮罩隨之淡出
      .fromTo(themeProgress, { value: 0 }, { value: 1, duration: FLIP2 / 2, immediateRender: false }, ACT4)
      .fromTo(bgShade.value, { opacity: 1 }, { opacity: 0, duration: FLIP2 / 2, immediateRender: false }, ACT4)
      // 翻到側面的瞬間：背面（第三幕背景）隱藏，輪播卡片隨即在同一位置展開
      .fromTo(bgBack.value, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0, immediateRender: false }, FLIP2_MID)

    // 第四幕：區塊資訊進場 + 作品輪播（兩列隨捲動往相反方向位移）
    panel?.works?.addTo(tl, FLIP2_MID, WORKS_SCROLL, isMobile)
    sectionTimes.works = FLIP2_MID + 1 // 作品區進場完成、輪播開始位移前（對應 WorksBoard 的 moveAt）

    // ── 第五幕：作品區退場 → 深色底升起、Panel 配色 黑 → 白 → 聯絡 / Footer 進場 ──
    const ACT5 = tl.duration() + ACT4_HOLD
    act5At = ACT5
    panel?.works?.addOutro(tl, ACT5)
    tl.fromTo(endBg.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: ACT5_IN, ease: 'power1.inOut' }, ACT5).fromTo(
      themeProgress,
      { value: 1 },
      { value: 0, duration: ACT5_IN, immediateRender: false },
      ACT5
    )
    panel?.contact?.addTo(tl, ACT5 + ACT5_IN / 2, (window.innerHeight * VH_PER_UNIT) / 100)

    // ── 環狀文字：桌機版第四幕停在右欄落點，第五幕隨捲動翻滾著飛到底部、放大，字逐漸平躺成俯視的文字環，淡化成背景點綴；
    //    行動版第四幕沒有落點，第五幕才直接在底部淡入。位置以 Panel 內容區（main）為基準換算 ──
    const mainRect = () => refs!.mainEl.getBoundingClientRect()
    const ringStart = () => {
      const r = panel!.works!.ringSlotRect()
      const m = mainRect()
      return { left: r.left - m.left, top: r.top - m.top, width: r.width }
    }
    const ringEnd = () => {
      const m = mainRect()
      const width = m.width * (isMobile ? RING_END_SCALE.mobile : RING_END_SCALE.desktop)
      // 正面的字距環中心約 (半徑 0.4 + 半個字高 0.12) × sin(傾斜角) 倍環寬：依此把正面的字放在底列（40px）上方
      const frontReach = 0.52 * Math.sin((Math.abs(RING_END_TILT) * Math.PI) / 180)
      return { left: (m.width - width) / 2, top: m.height - 40 - width * (0.25 + frontReach), width }
    }
    const ringFrom = isMobile ? ringEnd : ringStart
    // 終點傾斜角再多轉 RING_ROLL 圈：飛行途中圓環繞水平軸翻滾，最後停在相同的俯視角
    const tiltEnd = { x: RING_END_TILT - 360 * RING_ROLL, z: 0, lay: RING_END_LAY }
    const tiltFrom = isMobile ? tiltEnd : { x: -16, z: -8, lay: 0 }
    ringAt = isMobile ? ACT5 + ACT5_IN / 2 : FLIP2_MID
    tl.fromTo(
      refs?.ringFloat ?? null,
      {
        left: () => ringFrom().left,
        top: () => ringFrom().top,
        width: () => ringFrom().width,
        '--ring-tilt-x': `${tiltFrom.x}deg`,
        '--ring-tilt-z': `${tiltFrom.z}deg`,
        '--ring-lay': `${tiltFrom.lay}deg`
      },
      {
        left: () => ringEnd().left,
        top: () => ringEnd().top,
        width: () => ringEnd().width,
        '--ring-tilt-x': `${tiltEnd.x}deg`,
        '--ring-tilt-z': `${tiltEnd.z}deg`,
        '--ring-lay': `${tiltEnd.lay}deg`,
        duration: RING_FLY,
        ease: 'power2.inOut'
      },
      ACT5
    )
      .fromTo(
        refs?.ringFade ?? null,
        { opacity: isMobile ? RING_END_ALPHA : 1 },
        { opacity: RING_END_ALPHA, duration: RING_FLY },
        ACT5
      )
      // 進場：桌機版隨第四幕右欄縮放淡入，行動版於第五幕深色底升起一半後淡入
      .fromTo(
        refs?.ringFloat ?? null,
        { autoAlpha: 0, scale: isMobile ? 1 : 0.85 },
        { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'power2.out' },
        isMobile ? ACT5 + ACT5_IN / 2 : FLIP2_MID + 0.4
      )

    // 結尾停留
    tl.to({}, { duration: END_HOLD })
    sectionTimes.contact = tl.duration() // 第五幕為頁面終點：直接捲到底

    // 捲動空間 = timeline 總長換算的捲動距離 + 一個視窗高（各斷點的每段捲動手感一致）
    if (spacer.value) spacer.value.style.height = `${tl.duration() * VH_PER_UNIT + 100}vh`

    trigger = ScrollTrigger.create({
      animation: tl,
      trigger: root.value,
      start: 'top top',
      end: 'bottom bottom', // 捲到 root 底部時剛好播完
      scrub: 0.5, // 平滑跟隨捲動
      invalidateOnRefresh: true, // 視窗尺寸變更時重新計算
      onUpdate: (self) => updateGates(self.progress * (tl?.duration() ?? 0))
    })
    // 斷點切換重建後，依目前捲動位置同步一次門檻狀態（亂碼 / Block Reveal 等非 scrub 的進退場）
    updateGates(trigger.progress * tl.duration())
  }

  onMounted(() => {
    // 重新整理時強制回到頁面最頂端（雙保險，搭配 scroll-restoration.client 插件），
    // 避免捲動停在中間時 ScrollTrigger 從中間區段起算
    window.scrollTo(0, 0)

    // 先立即把「下滑才出現」的元素設為起始隱藏態（progress 0 的樣子）。
    // 否則 loading 遮罩淡出（約 3s）到捲動動畫建立（約 3.3s）之間的空窗期，
    // 這些元素會以 CSS 預設的可見態短暫浮現（角色卡片、右側區塊與其邊線），再被 timeline 設回隱藏而閃現。
    const refs = panelRef.value?.$refs
    if (refs) {
      gsap.set([refs.characterWrap, refs.aboutWrap], { opacity: 0 })
      gsap.set(refs.characterCard, { opacity: 0, rotationY: -180, transformOrigin: 'center' })
    }

    // 開場 loading 結束（直接開啟約 3 秒；站內換頁立即）後：先播主頁面進場（左上解碼 + 右下標題），再建立捲動動畫
    cancelStart = onLoaded(() => {
      panelRef.value?.enter()
      welcomeOn.value = true
      // 行動版 / 桌機版各建一條 timeline（對應 Tailwind md 斷點 768px）
      mm = gsap.matchMedia()
      mm.add({ isMobile: '(max-width: 767px)', isDesktop: '(min-width: 768px)' }, (ctx) => {
        buildTimeline(!!ctx.conditions?.isMobile)
      })
    })
  })

  onBeforeUnmount(() => {
    cancelStart?.()
    mm?.revert() // 一併清除 matchMedia 內建立的 timeline 與 ScrollTrigger
  })
</script>

<template>
  <div ref="root" class="w-full">
    <div class="relative w-full p-3 md:p-6 z-10" :style="panelTheme">
      <Panel ref="panelRef" @navigate="scrollToSection" />
    </div>

    <!-- 背景大圖：固定定位，往下捲時縮成右下角小圖並長出科技感切角（第二幕），
         再以 Y 軸立體翻轉、放大成滿版背景（第三幕）。不設 overflow-hidden，避免翻轉時透視投影被裁切 -->
    <div ref="bgWrap" class="fixed right-0 bottom-0 w-screen h-dvh z-0 perspective-[1200px]">
      <!-- 翻轉卡片：整張以中心為軸 rotateY 0 → 180° -->
      <div ref="bgCard" class="relative w-full h-full transform-3d">
        <!-- 正面：第一、二幕的主視覺 -->
        <div ref="bgFront" class="absolute inset-0">
          <TechFrame
            :strokeWidth="0"
            :top-left="bgCorners.topLeft"
            :top-right="bgCorners.topRight"
            :bottom-right="bgCorners.bottomRight"
            :bottom-left="bgCorners.bottomLeft"
            class="w-full h-full"
          >
            <!-- 前後景分層：原圖 → WELCOME 實心字 → 主角去背圖 → WELCOME 外框字。
                 滑鼠 3D 傾斜套在共同外層，四層一起傾斜、彼此對齊 -->
            <div class="relative w-full h-full will-change-transform" :style="{ transform: tiltStyle }">
              <!-- 行動版（< md，對應 Tailwind 768px 斷點）載入直式圖，其餘載入橫式圖；瀏覽器只會下載符合的那一張 -->
              <picture class="block w-full h-full">
                <source media="(max-width: 767px)" :srcset="bannerM" />
                <img :src="bannerPc" alt="main" class="w-full h-full object-cover" />
              </picture>
              <div ref="welcomeBack" class="absolute inset-0">
                <HeroWelcome layer="back" :on="welcomeOn" />
              </div>
              <picture class="absolute inset-0">
                <source media="(max-width: 767px)" :srcset="bannerMSubject" />
                <img :src="bannerPcSubject" alt="" class="hero-subject w-full h-full object-cover" />
              </picture>
              <div ref="welcomeFront" class="absolute inset-0">
                <HeroWelcome layer="front" :on="welcomeOn" />
              </div>
            </div>
          </TechFrame>
        </div>
        <!-- 背面：第三幕滿版背景（預先翻 180°，卡片翻完後正好轉正；翻到側面前保持隱藏） -->
        <div ref="bgBack" class="absolute inset-0 rotate-y-180 invisible opacity-0">
          <TechFrame
            :strokeWidth="0"
            :top-left="bgCorners.topLeft"
            :top-right="bgCorners.topRight"
            :bottom-right="bgCorners.bottomRight"
            :bottom-left="bgCorners.bottomLeft"
            class="w-full h-full"
          >
            <!-- 分層場景：以畫框為尺寸容器，場景框維持原圖比例並覆蓋畫框（至少 130% 畫框高，留視差位移空間），
                 三層圖片疊在同一個場景框內，彼此才會精準對齊 -->
            <div class="absolute inset-0 overflow-hidden [container-type:size]">
              <div ref="bgParallax" class="stage-scene will-change-transform">
                <!-- 滑鼠 3D 傾斜套在三層的共同外層（與 gsap 的位移分開，避免 transform 互相覆蓋） -->
                <div class="absolute inset-0" :style="{ transform: tiltStyle }">
                  <img ref="stageBgEl" :src="stageBg" alt="" class="stage-bg will-change-transform" />
                  <img :src="stageSubject" alt="skills background" class="absolute inset-0 w-full h-full" />
                  <img
                    ref="stageFgEl"
                    :src="stageFg"
                    alt=""
                    class="absolute inset-0 w-full h-full origin-bottom will-change-transform"
                  />
                  <!-- 第四層 HUD：與主體同速，疊在最上方（仍在壓暗遮罩之下） -->
                  <StageHud ref="stageHud" />
                </div>
              </div>
            </div>
            <!-- 壓暗遮罩：讓第三幕白字可讀（行動版文字滿寬，改為均勻壓暗） -->
            <div
              ref="bgShade"
              class="absolute inset-0 bg-linear-to-r from-black/75 via-black/55 to-black/35 max-md:bg-none max-md:bg-black/65 opacity-0"
            ></div>
          </TechFrame>
        </div>
      </div>
    </div>

    <!-- 第五幕深色底：疊在背景大圖之上、Panel 之下，作品區退場時淡入（呼應 kprverse 的黑色 footer） -->
    <div ref="endBg" class="fixed inset-0 z-[5] bg-[#0b0b0b] invisible opacity-0"></div>

    <!-- 製造捲動距離（初始高度供 timeline 建立前使用，建立後依 timeline 總長改寫） -->
    <section ref="spacer" class="relative z-10 h-[300vh] pointer-events-none"></section>
  </div>
</template>

<style scoped>
  /* 第一幕主角去背圖：淡淡的暗色光暈，讓白色上衣與背後的白色 WELCOME 分得開 */
  .hero-subject {
    filter: drop-shadow(0 0 18px rgb(0 0 0 / 0.45));
  }

  /* 第三幕場景框：原圖比例 1182:1330，寬度取「畫框寬」與「130% 畫框高換算的寬」較大者，確保覆蓋畫框並留下視差空間；
     水平置中、垂直對齊 0~130% 畫框高的中段（等同原本 object-cover 的置中裁切）。
     置中以 left / top 計算，不用 translate：gsap 補間 y 時會接管 translate 屬性，含 calc() 的值會被丟棄 */
  .stage-scene {
    --scene-w: max(100cqw, 130cqh * 1182 / 1330);
    position: absolute;
    left: calc((100cqw - var(--scene-w)) / 2);
    top: calc((130cqh - var(--scene-w) * 1330 / 1182) / 2);
    width: var(--scene-w);
    aspect-ratio: 1182 / 1330;
  }

  /* 行動版直式畫框只看得到場景中段，而主角位於場景偏左（臉部中心約在 35% 寬處）：
     場景往右移，讓主角置中；位移量上限為場景超出畫框的一半，確保左緣不會露出空白 */
  @media (max-width: 767px) {
    .stage-scene {
      left: calc((100cqw - var(--scene-w)) / 2 + min(var(--scene-w) * 0.15, (var(--scene-w) - 100cqw) / 2));
    }
  }

  /* 背景層：原圖上下各延伸 200px（1730 / 1330），往上超出場景 200 / 1330 */
  .stage-bg {
    position: absolute;
    left: 0;
    top: calc(-200 / 1330 * 100%);
    width: 100%;
    height: calc(1730 / 1330 * 100%);
  }
</style>
