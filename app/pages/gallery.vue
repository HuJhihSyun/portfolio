<script setup lang="ts">
  import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import type { GalleryCategory, GalleryResponse } from '#shared/gallery'

  gsap.registerPlugin(ScrollTrigger)

  /**
   * Gallery 頁：Instagram 貼文（Posts）→ Behance 作品（Works），兩段接在同一條捲動上。
   * 外框沿用首頁的 PanelShell（固定定位），內容由頁面捲動驅動：同首頁，所有段落排在一條主 timeline、
   * 由單一 ScrollTrigger 依捲動進度播放；各段落的補間由 GalleryPosts.addTo()、GalleryWorks.addTo() 接入。
   * 頂部選單：依目前捲動位置標示所在段落，點擊時捲到該段落；網址帶 #works 時直接跳到 Works。
   */

  useSiteSeo('gallery') // 標題 / 描述 / 分享卡片 / canonical（內容見 shared/site.ts）

  const TABS: { label: string; key: GalleryCategory }[] = [
    { label: 'Posts', key: 'posts' },
    { label: 'Works', key: 'works' }
  ]
  const category = ref<GalleryCategory>('posts') // 目前捲動所在的段落

  // 兩個 API 同時請求
  const [{ data: posts }, { data: works }] = await Promise.all([
    useFetch<GalleryResponse>('/api/gallery/posts'),
    useFetch<GalleryResponse>('/api/gallery/works')
  ])

  // 深色主題（同首頁第五幕）：外框與文字為白色
  const panelTheme = {
    '--panel-fg': '#fff',
    '--panel-bg': '#0b0b0b',
    '--panel-line': 'rgb(255 255 255 / 0.35)'
  }

  type BrowseRange = {
    browseAt: number
    browseEnd: number
    cardDur: number
    count: number
    exitAt: number // 最後一張大圖開始滑走的時間
    exitDur: number
  }
  const root = ref<HTMLElement | null>(null)
  const spacer = ref<HTMLElement | null>(null)
  const shell = ref<{ setProgress: (progress: number) => void } | null>(null)
  const postsRef = ref<{
    addTo: (tl: gsap.core.Timeline, isMobile: boolean) => BrowseRange
    onScroll: (time: number) => void
  } | null>(null)
  const worksRef = ref<{
    addTo: (tl: gsap.core.Timeline, isMobile: boolean, at: number) => { readyAt: number }
    onScroll: (time: number) => void
  } | null>(null)
  // 各段落在主 timeline 上的時間點（點擊頂部選單時捲到這裡）
  const sectionAt: Record<GalleryCategory, number> = { posts: 0, works: Infinity }

  const VH_PER_UNIT = 50 // 每 1 單位 timeline 時間對應的捲動距離（vh），同首頁
  const END_HOLD = 0.8 // 結尾停留
  let tl: gsap.core.Timeline | null = null
  let trigger: ScrollTrigger | null = null
  let mm: gsap.MatchMedia | null = null

  // 依斷點建立主 timeline（由 gsap.matchMedia 呼叫；跨越斷點時自動 revert 舊的並重建）
  const buildTimeline = (isMobile: boolean) => {
    const board = postsRef.value
    if (!board) return
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      paused: true,
      onUpdate: () => shell.value?.setProgress(tl?.progress() ?? 0)
    })
    const range = board.addTo(tl, isMobile)
    // Works：最後一張大圖滑走到一半時開始進場
    const worksRange = worksRef.value?.addTo(tl, isMobile, range.exitAt + range.exitDur * 0.55)
    sectionAt.works = worksRange?.readyAt ?? Infinity
    tl.to({}, { duration: END_HOLD })

    if (spacer.value) spacer.value.style.height = `${tl.duration() * VH_PER_UNIT + 100}vh`

    // 瀏覽段落停止捲動後吸附到最近的一張卡片；其他段落不吸附（回傳原值）
    const snapTo = (progress: number) => {
      if (!tl) return progress
      const duration = tl.duration()
      const time = progress * duration
      if (time < range.browseAt - range.cardDur / 2 || time > range.browseEnd + range.cardDur / 2) return progress
      const index = gsap.utils.clamp(0, range.count - 1, Math.round((time - range.browseAt) / range.cardDur))
      return (range.browseAt + index * range.cardDur) / duration
    }

    trigger = ScrollTrigger.create({
      animation: tl,
      trigger: root.value,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
      invalidateOnRefresh: true,
      // inertia: false：依停下的位置吸附最近一張，不依捲動速度預測落點（快速甩動時才不會跳過好幾張）
      snap: { snapTo, inertia: false, delay: 0.12, duration: { min: 0.2, max: 0.6 }, ease: 'power1.inOut' },
      onUpdate: (self) => onScroll(self.progress * (tl?.duration() ?? 0))
    })
    onScroll(trigger.progress * tl.duration())

    // 網址帶 #works（例如從其他頁連過來）：直接跳到 Works
    if (!jumped && route.hash === '#works' && Number.isFinite(sectionAt.works)) {
      jumped = true
      jumpTo(sectionAt.works)
    }
  }

  // 直接跳到某個時間點：開場 loading 剛結束時頁面可能還暫時鎖住捲動，捲不動就下一幀再試（最多約 1 秒）
  const jumpTo = (time: number, tries = 60) => {
    const top = seek(time, 'instant')
    if (top === undefined) return
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - top) > 2 && tries > 0) jumpTo(time, tries - 1)
    })
  }

  const route = useRoute()
  let jumped = false
  // 同一頁內切換到 #works（例如從側選單或站內連結）：平滑捲到 Works
  watch(
    () => route.hash,
    (hash) => hash === '#works' && goTo('works')
  )

  const onScroll = (time: number) => {
    postsRef.value?.onScroll(time)
    worksRef.value?.onScroll(time)
    category.value = time >= sectionAt.works - 0.5 ? 'works' : 'posts'
  }

  // GalleryPosts 請求捲到某個時間點（點擊兩側卡片、上一張 / 下一張）：換算成捲動位置後平滑捲過去
  const seek = (time: number, behavior: ScrollBehavior = 'smooth') => {
    if (!tl || !trigger) return
    // ScrollTrigger 剛建立、還沒量測時 start / end 為 NaN：改以頁面可捲動的範圍推算（start 為頁首）
    const start = Number.isFinite(trigger.start) ? trigger.start : 0
    const end = Number.isFinite(trigger.end) ? trigger.end : document.documentElement.scrollHeight - window.innerHeight
    const top = Math.round(start + (time / tl.duration()) * (end - start))
    window.scrollTo({ top, behavior })
    return top
  }

  // 頂部選單：捲到該段落
  const goTo = (key: GalleryCategory) => {
    const time = sectionAt[key]
    if (Number.isFinite(time)) seek(time)
  }

  // 開場 loading 結束（直接開啟約 3 秒；站內換頁立即）後才播進場、建立捲動動畫
  const entered = ref(false)
  const { onLoaded } = useGlobalLoading()
  let cancelEnter: (() => void) | null = null
  onMounted(() => {
    window.scrollTo(0, 0)
    cancelEnter = onLoaded(() => {
      entered.value = true
      mm = gsap.matchMedia()
      mm.add({ isMobile: '(max-width: 767px)', isDesktop: '(min-width: 768px)' }, (ctx) => {
        buildTimeline(!!ctx.conditions?.isMobile)
      })
    })
  })
  onBeforeUnmount(() => {
    cancelEnter?.()
    mm?.revert()
  })
</script>

<template>
  <div ref="root" class="w-full">
    <!-- 頁面深色底（Panel 外框四周的留白也是深色） -->
    <div class="fixed inset-0 z-0 bg-[#0b0b0b]" aria-hidden="true"></div>
    <div class="relative z-10 w-full p-3 md:p-6" :style="panelTheme">
      <PanelShell ref="shell" :items="TABS" :active="category" @navigate="goTo">
        <!-- Posts 與 Works 疊在同一個內容區：Works 絕對定位蓋在上方，由主 timeline 控制何時出現 -->
        <div class="relative h-full min-w-0 flex-1">
          <GalleryPosts ref="postsRef" :items="posts?.items ?? []" :entered="entered" @seek="(t) => seek(t)" />
          <GalleryWorks ref="worksRef" :items="works?.items ?? []" @seek="(t) => seek(t)" />
        </div>
      </PanelShell>
    </div>
    <!-- 製造捲動距離（初始高度供 timeline 建立前使用，建立後依 timeline 總長改寫） -->
    <section ref="spacer" class="relative z-10 h-[300vh] pointer-events-none"></section>
  </div>
</template>
