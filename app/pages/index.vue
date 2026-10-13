<script lang="ts" setup>
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'

  import mainPic from '@/assets/images/main.png'
  // 第三幕滿版背景（TODO: 換成專屬的第三幕視覺；目前暫用主視覺）
  import stagePic from '@/assets/images/main.png'

  gsap.registerPlugin(ScrollTrigger)

  const { tiltStyle } = useTilt({ max: 1, scale: 1.06 })

  const root = ref<HTMLElement | null>(null)
  const spacer = ref<HTMLElement | null>(null)
  const bgWrap = ref<HTMLElement | null>(null)
  const bgCard = ref<HTMLElement | null>(null)
  const bgFront = ref<HTMLElement | null>(null)
  const bgBack = ref<HTMLElement | null>(null)
  const bgShade = ref<HTMLElement | null>(null)
  const panelRef = ref<{
    enter: () => void
    scrambleOut: () => void
    scrambleIn: () => void
    revealOut: () => void
    revealIn: () => void
    aboutIn: () => void
    aboutOut: () => void
    skills: {
      addTo: (tl: gsap.core.Timeline, at: number, isMobile?: boolean, unitPx?: number) => void
      enter: () => void
      leave: () => void
    } | null
    $refs: {
      headerText: HTMLElement
      characterWrap: HTMLElement
      characterCard: HTMLElement
      aboutWrap: HTMLElement
      bgSlot: HTMLElement
    }
  } | null>(null)

  // 主 timeline 的分段（timeline 時間單位；實際捲動距離依比例分配到 root 的高度）
  const ACT2 = 1 // 第二幕：大圖縮成小圖、角色卡片翻入
  const ACT3 = ACT2 + 0.3 // 第三幕起點（第二幕播完後稍作停留）
  const FLIP = 1.2 // 小圖立體翻轉 + 放大至滿版的長度
  const FLIP_MID = ACT3 + FLIP / 2 // 翻到 90°（側面）的時間點：正反面在此切換
  const SKILLS = ACT3 + FLIP // 技能矩陣 / 時間軸進場起點

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

    // 開始下捲 → 左上亂碼解散、右下標題 line-reveal 退場；捲回頂端 → 還原
    syncGate(
      'header',
      time > 0.02,
      () => (panel.scrambleOut(), panel.revealOut()),
      () => (panel.scrambleIn(), panel.revealIn())
    )
    // 右側 nameWrap Block Reveal + aboutText 解碼：只在第二幕期間顯示
    syncGate('about', time > 0.02 && time < ACT3 + 0.05, panel.aboutIn, panel.aboutOut)
    // 第三幕標題亂碼解碼
    syncGate(
      'skills',
      time > SKILLS,
      () => panel.skills?.enter(),
      () => panel.skills?.leave()
    )

    // 依「實際渲染透明度」切換 display（讀當前值而非進度，避開 scrub 延遲殘影）：
    // 全透明後設 display:none 不再佔版面，回捲可見時還原成預設 display。
    const el = panel.$refs.headerText
    if (el) {
      const opacity = Number(gsap.getProperty(el, 'opacity'))
      el.style.display = opacity <= 0.01 ? 'none' : ''
    }
  }

  const LOADING_DELAY = 3000 // 開場 loading 動畫時長（ms），捲動動畫延遲同樣時間再建立
  const VH_PER_UNIT = 50 // 每 1 單位 timeline 時間對應的捲動距離（vh），捲動空間依 timeline 總長換算
  let tl: gsap.core.Timeline | null = null
  let mm: gsap.MatchMedia | null = null
  let startTimer: ReturnType<typeof setTimeout> | null = null

  // 依斷點建立主 timeline（由 gsap.matchMedia 呼叫；跨越斷點時自動 revert 舊的並重建）
  const buildTimeline = (isMobile: boolean) => {
    const refs = panelRef.value?.$refs
    // 第二幕小圖落點（視窗座標）；以函式值傳給補間，搭配 invalidateOnRefresh 在視窗尺寸變更時重新量測
    const slotRect = () => refs!.bgSlot.getBoundingClientRect()

    // 所有動畫排在同一條主 timeline、由單一 ScrollTrigger 驅動。
    // 先排好補間、依總長設定捲動空間，最後才建立 ScrollTrigger（確保量測到正確的捲動範圍）
    tl = gsap.timeline({ defaults: { ease: 'none', duration: 1 }, paused: true })

    // 注意：因 invalidateOnRefresh，視窗尺寸變更時補間會重新記錄起始值。
    // 若用 .to()，在捲動途中 resize 會把「當下的中間狀態」誤記為起點，回捲時就無法還原，
    // 因此各段的起始狀態一律以 fromTo 明確指定（第三幕的 fromTo 加 immediateRender:false，避免建立時就套用）。
    tl
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
        0
      )
      // 背景大圖長出科技感切角、Panel 配色 白 → 黑
      .fromTo(cornerProgress, { value: 0 }, { value: 1 }, 0)
      .fromTo(themeProgress, { value: 0 }, { value: 1 }, 0)
      // 左上 profile 文字：淡出
      .fromTo(refs?.headerText, { opacity: 1 }, { opacity: 0 }, 0)
      // 角色欄整體淡入
      .fromTo(refs?.characterWrap, { opacity: 0 }, { opacity: 1 }, 0)
      // 角色卡片：以中心為軸翻轉進入
      .fromTo(
        refs?.characterCard,
        { rotationY: -180, opacity: 0 },
        { rotationY: 0, opacity: 1, transformOrigin: 'center' },
        0
      )
      .fromTo(refs?.aboutWrap, { opacity: 0 }, { opacity: 1 }, 0)

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
    panelRef.value?.skills?.addTo(tl, SKILLS, isMobile, (window.innerHeight * VH_PER_UNIT) / 100)

    // 結尾停留，讓第三幕內容完整呈現後還有一段捲動空間
    tl.to({}, { duration: 0.4 })

    // 捲動空間 = timeline 總長換算的捲動距離 + 一個視窗高（各斷點的每段捲動手感一致）
    if (spacer.value) spacer.value.style.height = `${tl.duration() * VH_PER_UNIT + 100}vh`

    const trigger = ScrollTrigger.create({
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

    // 開場 loading 結束（約 3 秒）後：先播主頁面進場（左上解碼 + 右下標題），再建立捲動動畫
    startTimer = setTimeout(() => {
      panelRef.value?.enter()
      // 行動版 / 桌機版各建一條 timeline（對應 Tailwind md 斷點 768px）
      mm = gsap.matchMedia()
      mm.add({ isMobile: '(max-width: 767px)', isDesktop: '(min-width: 768px)' }, (ctx) => {
        buildTimeline(!!ctx.conditions?.isMobile)
      })
    }, LOADING_DELAY)
  })

  onBeforeUnmount(() => {
    if (startTimer) clearTimeout(startTimer)
    mm?.revert() // 一併清除 matchMedia 內建立的 timeline 與 ScrollTrigger
  })
</script>

<template>
  <div ref="root" class="w-full">
    <div class="relative w-full p-3 md:p-6 z-10" :style="panelTheme">
      <Panel ref="panelRef" />
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
            <img
              :src="mainPic"
              alt="main"
              class="w-full h-full object-cover will-change-transform"
              :style="{ transform: tiltStyle }"
            />
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
            <img
              :src="stagePic"
              alt="skills background"
              class="w-full h-full object-cover will-change-transform"
              :style="{ transform: tiltStyle }"
            />
            <!-- 壓暗遮罩：讓第三幕白字可讀（行動版文字滿寬，改為均勻壓暗） -->
            <div
              ref="bgShade"
              class="absolute inset-0 bg-linear-to-r from-black/75 via-black/55 to-black/35 max-md:bg-none max-md:bg-black/65 opacity-0"
            ></div>
          </TechFrame>
        </div>
      </div>
    </div>

    <!-- 製造捲動距離（初始高度供 timeline 建立前使用，建立後依 timeline 總長改寫） -->
    <section ref="spacer" class="relative z-10 h-[300vh] pointer-events-none"></section>
  </div>
</template>
