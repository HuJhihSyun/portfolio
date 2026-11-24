<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, useId } from 'vue'
  import gsap from 'gsap'

  /**
   * ScrollBadge：第一幕的捲動提示徽章（圓形環繞文字 + 中央往右下的箭頭）。
   * 以網站的 HUD 調性呈現：外圈刻度環與文字環反向旋轉，四角加上準星框線。
   * hover：旋轉加速、中央圓填滿、箭頭往右下滑出再從左上滑回。
   * 點擊：旋轉急加速 → 箭頭往右下射出 → 徽章放大淡出（像衝擊波擴散），同時通知父層捲到第二幕。
   * reset() 讓徽章回到初始狀態（捲回第一幕時由父層呼叫）。
   */

  const props = withDefaults(defineProps<{ text?: string }>(), { text: 'About me · Scroll to explore · ' })
  const emit = defineEmits<{ click: [] }>()

  // SVG 座標（viewBox 0 0 120 120，中心 60,60）
  const C = 60
  const TEXT_R = 45 // 文字環半徑
  const textPath = `M ${C},${C} m -${TEXT_R},0 a ${TEXT_R},${TEXT_R} 0 1,1 ${TEXT_R * 2},0 a ${TEXT_R},${TEXT_R} 0 1,1 -${TEXT_R * 2},0`
  const textLength = (2 * Math.PI * TEXT_R * 0.995).toFixed(1) // 文字均分整圈，頭尾不重疊
  // SVG 內部參照的 id（文字路徑 / 裁切）：每個實例唯一，避免頁面上有多個徽章時互相干擾
  const uid = useId()
  const pathId = `scroll-badge-path-${uid}`
  const clipId = `scroll-badge-clip-${uid}`

  // 座標四捨五入到小數兩位：伺服器（SSR）與瀏覽器的三角函數末位精度可能不同，未取整會造成 hydration 不一致
  const round = (n: number) => Math.round(n * 100) / 100
  // 外圈刻度：每 6° 一格，每 30° 為長刻度
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 * Math.PI) / 180
    const major = i % 5 === 0
    const r1 = major ? 54 : 56
    const r2 = 59
    return {
      x1: round(C + r1 * Math.cos(a)),
      y1: round(C + r1 * Math.sin(a)),
      x2: round(C + r2 * Math.cos(a)),
      y2: round(C + r2 * Math.sin(a)),
      major
    }
  })

  const root = ref<HTMLElement | null>(null)
  const textRing = ref<SVGGElement | null>(null)
  const tickRing = ref<SVGGElement | null>(null)
  const arrow = ref<SVGGElement | null>(null)

  let spin: gsap.core.Timeline | null = null
  let leaving: gsap.core.Timeline | null = null
  const BASE = 1
  const HOVER = 4

  const setSpeed = (scale: number, duration = 0.5) => {
    if (spin) gsap.to(spin, { timeScale: scale, duration, ease: 'power2.out', overwrite: true })
  }
  const onEnter = () => !leaving && setSpeed(HOVER)
  const onLeave = () => !leaving && setSpeed(BASE, 1)

  const onClick = () => {
    if (leaving) return
    emit('click') // 立即開始捲動，徽章的退場與第二幕轉場同時進行
    leaving = gsap
      .timeline()
      .add(() => setSpeed(12, 0.3))
      .to(arrow.value, { x: 26, y: 26, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, 0)
      .to(root.value, { scale: 2.4, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, 0.12)
  }

  // 回到初始狀態（徽章淡入、箭頭歸位、轉速復原）
  const reset = () => {
    if (!leaving) return
    leaving.kill()
    leaving = null
    gsap.set(arrow.value, { x: 0, y: 0, autoAlpha: 1 })
    gsap.fromTo(root.value, { scale: 0.85, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'power2.out' })
    setSpeed(BASE, 0.3)
  }

  const play = () => spin?.play()
  const pause = () => spin?.pause()

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // 文字環順時針、刻度環以較慢速度逆時針，形成兩層錯動的 HUD 感
    spin = gsap
      .timeline({ repeat: -1 })
      .to(textRing.value, { rotation: 360, svgOrigin: `${C} ${C}`, duration: 18, ease: 'none' }, 0)
      .to(tickRing.value, { rotation: -120, svgOrigin: `${C} ${C}`, duration: 18, ease: 'none' }, 0)
  })

  onBeforeUnmount(() => {
    spin?.kill()
    leaving?.kill()
  })

  defineExpose({ reset, play, pause })
</script>

<template>
  <button
    ref="root"
    type="button"
    class="scroll-badge group"
    :aria-label="text.replace(/·/g, '').trim()"
    @click="onClick"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focus="onEnter"
    @blur="onLeave"
  >
    <svg viewBox="0 0 120 120" class="block h-full w-full overflow-visible" aria-hidden="true">
      <!-- 四角準星框線 -->
      <g class="corners" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M2 12 V2 H12" />
        <path d="M108 2 H118 V12" />
        <path d="M118 108 V118 H108" />
        <path d="M12 118 H2 V108" />
      </g>
      <!-- 外圈刻度環 -->
      <g ref="tickRing" stroke="currentColor">
        <line
          v-for="(t, i) in ticks"
          :key="i"
          :x1="t.x1"
          :y1="t.y1"
          :x2="t.x2"
          :y2="t.y2"
          :stroke-width="t.major ? 1 : 0.6"
          :opacity="t.major ? 0.9 : 0.45"
        />
      </g>
      <!-- 文字環 -->
      <g ref="textRing">
        <path :id="pathId" :d="textPath" fill="none" />
        <text class="badge-text" fill="currentColor">
          <textPath :href="`#${pathId}`" :textLength="textLength" lengthAdjust="spacing">{{ text }}</textPath>
        </text>
      </g>
      <!-- 中央圓 + 箭頭（箭頭裁切在圓內，hover 時滑出再滑回） -->
      <clipPath :id="clipId">
        <circle :cx="C" :cy="C" r="27" />
      </clipPath>
      <circle class="badge-core" :cx="C" :cy="C" r="27" stroke="currentColor" stroke-width="0.75" />
      <g :clip-path="`url(#${clipId})`">
        <g ref="arrow">
          <g class="badge-arrow" fill="none" stroke-width="1.5" stroke-linecap="square">
            <path d="M52 52 L68 68" />
            <path d="M57 68 H68 V57" />
          </g>
        </g>
      </g>
    </svg>
  </button>
</template>

<style lang="scss" scoped>
  .scroll-badge {
    display: block;
    cursor: pointer;
    color: inherit;
    /* 與第一幕文字相同的陰影，壓在主視覺上仍清楚 */
    filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--panel-bg, #000) 70%, transparent))
      drop-shadow(0 0 10px color-mix(in srgb, var(--panel-bg, #000) 45%, transparent));

    &:focus-visible {
      outline: 1px dashed currentColor;
      outline-offset: 6px;
    }
  }

  .badge-text {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* 中央圓：平時透明，hover 時填滿前景色、箭頭反白（呼應網站按鈕的 hover 反白） */
  .badge-core {
    fill: transparent;
    transition: fill 0.3s;
  }

  .badge-arrow {
    stroke: currentColor;
    transition: stroke 0.3s;
  }

  .corners {
    opacity: 0.6;
    transition:
      transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.3s;
    transform-origin: 60px 60px;
  }

  .scroll-badge:hover,
  .scroll-badge:focus-visible {
    .badge-core {
      fill: currentColor;
    }

    .badge-arrow {
      stroke: var(--panel-bg, #000);
      animation: arrow-loop 0.6s cubic-bezier(0.65, 0, 0.35, 1);
    }

    /* 準星框線往內收，像對焦鎖定 */
    .corners {
      opacity: 1;
      transform: scale(0.92);
    }
  }

  /* 箭頭往右下滑出、再從左上滑回原位 */
  @keyframes arrow-loop {
    0% {
      transform: translate(0, 0);
    }
    45% {
      transform: translate(22px, 22px);
    }
    46% {
      transform: translate(-22px, -22px);
    }
    100% {
      transform: translate(0, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-badge:hover .badge-arrow {
      animation: none;
    }
  }
</style>
