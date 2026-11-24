<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import gsap from 'gsap'

  /**
   * TextRing：立體環狀文字。
   * 文字逐字排在一個圓柱面上（rotateY + translateZ），整個圓柱持續繞 Y 軸旋轉；
   * 外層再傾斜（rotateX / rotateZ），讓圓柱背面的字露出、形成環狀的立體感。
   * 每格依目前角度調整透明度：正面清楚、轉到背面的字變淡，背面的字自然呈現左右反向。
   * hover / focus 時旋轉加速，離開後緩緩回到原速。
   * 旋轉由 play() / pause() 控制，只在區塊顯示時跑動畫，隱藏時不佔用效能。
   */

  const props = withDefaults(
    defineProps<{
      text: string
      repeat?: number // 文字繞圈重複的次數
      speed?: number // 一般轉速（度 / 秒）
      hoverSpeed?: number // hover 時的轉速（度 / 秒）
    }>(),
    { repeat: 1, speed: 24, hoverSpeed: 110 }
  )

  defineEmits<{ click: [] }>()

  // 每段文字後補一個分隔點，讓重複的文字頭尾分得開
  const chars = computed(() => Array.from({ length: props.repeat }, () => [...`${props.text} · `]).flat())
  const step = computed(() => 360 / chars.value.length)

  // 圓柱半徑（按鈕寬度的百分比，cqw）；每格寬 = 圓周 ÷ 字數，字級隨之換算，換任何長度的文案都不會疊字或過鬆
  const RADIUS = 40
  const ringVars = computed(() => ({
    '--radius': `${RADIUS}cqw`,
    '--slot': `${((2 * Math.PI * RADIUS) / chars.value.length).toFixed(2)}cqw`
  }))

  const ringEl = ref<HTMLElement | null>(null)
  const charEls: HTMLElement[] = []

  const state = { angle: 0, speed: props.speed }
  let running = false
  let reduceMotion = false

  // 依目前角度更新圓柱旋轉與每格的透明度（cos = 1 為正對畫面，-1 為正背面）
  const render = () => {
    if (!ringEl.value) return
    ringEl.value.style.transform = `rotateY(${-state.angle}deg)`
    charEls.forEach((el, i) => {
      const facing = Math.cos(((i * step.value - state.angle) * Math.PI) / 180)
      el.style.opacity = String(0.12 + 0.88 * ((facing + 1) / 2) ** 1.6)
    })
  }

  const tick = (_time: number, deltaMs: number) => {
    state.angle = (state.angle + (state.speed * deltaMs) / 1000) % 360
    render()
  }

  const play = () => {
    if (running || reduceMotion) return
    running = true
    gsap.ticker.add(tick)
  }

  const pause = () => {
    if (!running) return
    running = false
    gsap.ticker.remove(tick)
  }

  // 加速 / 回速以補間過渡，避免轉速突變
  const setSpeed = (target: number, duration: number) => {
    gsap.to(state, { speed: target, duration, ease: 'power2.out', overwrite: true })
  }
  const speedUp = () => setSpeed(props.hoverSpeed, 0.5)
  const slowDown = () => setSpeed(props.speed, 1.2)

  onMounted(() => {
    // 偏好減少動態效果：不旋轉，停在固定角度
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    state.angle = 0
    render()
  })

  onBeforeUnmount(() => {
    pause()
    gsap.killTweensOf(state)
  })

  defineExpose({ play, pause })
</script>

<template>
  <button
    type="button"
    class="text-ring"
    :aria-label="text"
    @click="$emit('click')"
    @mouseenter="speedUp"
    @mouseleave="slowDown"
    @focus="speedUp"
    @blur="slowDown"
  >
    <span class="ring-scene" aria-hidden="true">
      <span ref="ringEl" class="ring-body" :style="ringVars">
        <span
          v-for="(char, i) in chars"
          :key="i"
          :ref="(el) => (charEls[i] = el as HTMLElement)"
          class="ring-char"
          :style="{ transform: `rotateY(${i * step}deg) translateZ(var(--radius)) scaleY(1.35)` }"
          >{{ char === ' ' ? ' ' : char }}</span
        >
      </span>
    </span>
  </button>
</template>

<style lang="scss" scoped>
  /* 尺寸皆依按鈕寬度換算（container query），在不同欄寬下維持相同比例 */
  .text-ring {
    container-type: inline-size;
    display: block;
    width: 100%;
    aspect-ratio: 2 / 1;
    cursor: pointer;
    position: relative;
    perspective: 1200px;
    color: inherit;

    &:focus-visible {
      outline: 1px dashed currentColor;
      outline-offset: 4px;
    }
  }

  /* 類名避開 Tailwind 的 ring / scene 等工具類（.ring 會被加上 1px 外框陰影） */
  .ring-scene,
  .ring-body {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
  }

  /* 圓柱傾斜：往後仰讓上緣的背面字露出，再微微斜放 */
  .ring-scene {
    transform: rotateX(-16deg) rotateZ(-8deg);
  }

  .ring-body {
    will-change: transform;
  }

  /* 每格寬度 = 圓周 ÷ 字數（--slot），字級約為格寬的 1.55 倍；字體略為拉高，呈現窄長的立體字 */
  .ring-char {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--slot);
    margin: -0.6em 0 0 calc(var(--slot) / -2);
    font-size: calc(var(--slot) * 1.55);
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    text-transform: uppercase;
    backface-visibility: visible;
    will-change: opacity;
  }
</style>
