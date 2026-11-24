<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import type { GalleryCategory, GalleryResponse } from '#shared/gallery'

  gsap.registerPlugin(ScrollTrigger)

  /**
   * Gallery 頁：目前只有 Instagram 貼文（Posts）。
   * 外框沿用首頁的 PanelShell（固定定位），內容由頁面捲動驅動：同首頁，所有段落排在一條主 timeline、
   * 由單一 ScrollTrigger 依捲動進度播放；各段落的補間由 GalleryPosts.addTo() 接入。
   * Works（Behance）區塊之後會以不同的版型另外製作：API（/api/gallery/works）與資料格式已先備好，
   * 屆時在 TABS 加回 Works、並依 category 切換對應的元件即可。
   */

  useSiteSeo('gallery') // 標題 / 描述 / 分享卡片 / canonical（內容見 shared/site.ts）

  const TABS: { label: string; key: GalleryCategory }[] = [{ label: 'Posts', key: 'posts' }]
  const category = ref<GalleryCategory>('posts')

  const { data: posts } = await useFetch<GalleryResponse>('/api/gallery/posts')

  // 深色主題（同首頁第五幕）：外框與文字為白色
  const panelTheme = {
    '--panel-fg': '#fff',
    '--panel-bg': '#0b0b0b',
    '--panel-line': 'rgb(255 255 255 / 0.35)'
  }

  type BrowseRange = { browseAt: number; browseEnd: number; cardDur: number; count: number }
  const root = ref<HTMLElement | null>(null)
  const spacer = ref<HTMLElement | null>(null)
  const shell = ref<{ setProgress: (progress: number) => void } | null>(null)
  const postsRef = ref<{
    addTo: (tl: gsap.core.Timeline, isMobile: boolean) => BrowseRange
    onScroll: (time: number) => void
  } | null>(null)

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
      onUpdate: (self) => board.onScroll(self.progress * (tl?.duration() ?? 0))
    })
    board.onScroll(trigger.progress * tl.duration())
  }

  // GalleryPosts 請求捲到某個時間點（點擊兩側卡片、上一張 / 下一張）：換算成捲動位置後平滑捲過去
  const seek = (time: number) => {
    if (!tl || !trigger) return
    const top = trigger.start + (time / tl.duration()) * (trigger.end - trigger.start)
    window.scrollTo({ top, behavior: 'smooth' })
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
      <PanelShell ref="shell" :items="TABS" :active="category" @navigate="(key) => (category = key)">
        <GalleryPosts
          v-if="category === 'posts'"
          ref="postsRef"
          :items="posts?.items ?? []"
          :entered="entered"
          @seek="seek"
        />
      </PanelShell>
    </div>
    <!-- 製造捲動距離（初始高度供 timeline 建立前使用，建立後依 timeline 總長改寫） -->
    <section ref="spacer" class="relative z-10 h-[300vh] pointer-events-none"></section>
  </div>
</template>
