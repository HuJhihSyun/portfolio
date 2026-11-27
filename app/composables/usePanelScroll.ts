import type { Ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface PanelScrollOptions {
  root: Ref<HTMLElement | null> // 頁面最外層（ScrollTrigger 的 trigger）
  spacer: Ref<HTMLElement | null> // 製造捲動距離的空白區塊
  viewport: Ref<HTMLElement | null> // Panel 內的可視區（固定高度、overflow hidden）
  flow: Ref<HTMLElement | null> // 可視區內實際捲動的內容
  onUpdate?: (progress: number) => void // 捲動進度 0～1（已平滑）
}

/**
 * Panel 內的內容捲動：PanelShell 是固定定位的外框，內容放在其中的可視區裡，
 * 頁面捲動時以 ScrollTrigger（scrub 平滑）把內容往上移；頁面的捲動距離與內容可捲動的高度 1:1。
 * 內容高度改變時（圖片載入、展開等）自動重新量測。
 */
export const usePanelScroll = (options: PanelScrollOptions) => {
  let scrollLen = 0
  let tl: gsap.core.Timeline | null = null
  let trigger: ScrollTrigger | null = null
  let ro: ResizeObserver | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const measure = () => {
    const viewport = options.viewport.value
    const flow = options.flow.value
    if (!viewport || !flow) return
    scrollLen = Math.max(0, flow.scrollHeight - viewport.clientHeight)
    if (options.spacer.value) options.spacer.value.style.height = `${scrollLen + window.innerHeight}px`
  }

  const remeasure = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      measure()
      ScrollTrigger.refresh()
    }, 120)
  }

  /** 建立捲動（在開場 loading / 換頁轉場結束後呼叫） */
  const build = () => {
    if (tl) return
    measure()
    tl = gsap.timeline({ paused: true, onUpdate: () => options.onUpdate?.(tl?.progress() ?? 0) })
    tl.fromTo(options.flow.value, { y: 0 }, { y: () => -scrollLen, ease: 'none', duration: 1 })
    trigger = ScrollTrigger.create({
      animation: tl,
      trigger: options.root.value,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
      invalidateOnRefresh: true
    })
    ro = new ResizeObserver(remeasure)
    if (options.flow.value) ro.observe(options.flow.value)
    if (options.viewport.value) ro.observe(options.viewport.value)
  }

  /** 捲到內容中的某個位置（px，相對於 flow 頂端）；ScrollTrigger 還沒量測時以頁面可捲動範圍推算 */
  const scrollToOffset = (offset: number, behavior: ScrollBehavior = 'smooth') => {
    if (!trigger) return
    if (!scrollLen) return window.scrollTo({ top: 0, behavior })
    const start = Number.isFinite(trigger.start) ? trigger.start : 0
    const end = Number.isFinite(trigger.end) ? trigger.end : document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: start + (Math.min(Math.max(0, offset), scrollLen) / scrollLen) * (end - start), behavior })
  }

  /** 目前內容捲動到的位置（px） */
  const currentOffset = () => (tl?.progress() ?? 0) * scrollLen

  const destroy = () => {
    clearTimeout(timer)
    ro?.disconnect()
    trigger?.kill()
    tl?.kill()
    tl = null
    trigger = null
  }

  return { build, destroy, measure, scrollToOffset, currentOffset }
}
