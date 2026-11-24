<script setup lang="ts">
  import { onBeforeUnmount, ref } from 'vue'

  /**
   * StageHud：第三幕分層場景的第四層（HUD 介面線條）。
   * 以原圖座標（1182×1330）定位，放在場景框內與主體同速視差，準星與線條會固定在畫面中的同一個位置。
   * play()：細線 / 圓弧逐段畫出 → 準星依序閃現 → 座標與程式碼框亂碼解碼；reset()：全部收回、清空文字。
   * 進退場時機由 index.vue 依捲動位置（第三幕期間）呼叫。
   */

  // 斜向 / 水平細線（原圖座標）
  const lines = [
    { x1: 640, y1: 0, x2: 1182, y2: 470 },
    { x1: 520, y1: 880, x2: 1182, y2: 610 },
    { x1: 0, y1: 1262, x2: 300, y2: 1262 },
    { x1: 0, y1: 1280, x2: 180, y2: 1280 }
  ]
  // 大圓弧：圓心 (430, 700)、半徑 470，取左上方一段（繞過主角頭部，從左緣延伸到頭頂右上）
  const ARC = { cx: 430, cy: 700, r: 470, from: 200, to: 300 }
  const polar = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return [Math.round(ARC.cx + ARC.r * Math.cos(a)), Math.round(ARC.cy + ARC.r * Math.sin(a))]
  }
  const [ax1, ay1] = polar(ARC.from)
  const [ax2, ay2] = polar(ARC.to)
  const arcPath = `M ${ax1} ${ay1} A ${ARC.r} ${ARC.r} 0 0 1 ${ax2} ${ay2}`
  // 圓弧上的刻度（每 8° 一格）
  const arcTicks = Array.from({ length: Math.floor((ARC.to - ARC.from) / 8) + 1 }, (_, i) => {
    const a = ((ARC.from + i * 8) * Math.PI) / 180
    const r1 = ARC.r - (i % 3 === 0 ? 14 : 7)
    return {
      x1: Math.round(ARC.cx + r1 * Math.cos(a)),
      y1: Math.round(ARC.cy + r1 * Math.sin(a)),
      x2: Math.round(ARC.cx + ARC.r * Math.cos(a)),
      y2: Math.round(ARC.cy + ARC.r * Math.sin(a))
    }
  })
  // 「+」準星
  const crosses = [
    { x: 355, y: 222 },
    { x: 636, y: 392 },
    { x: 810, y: 795 },
    { x: 180, y: 1010 },
    { x: 1120, y: 1150 }
  ]

  const COORD = ['25.0330° N', '121.5654° E']
  const CODE = ['const create = () => {', '  return inspiration;', '};']

  const coordScrambles = COORD.map(() => useTextScramble({ duration: 30 }))
  const codeScrambles = CODE.map(() => useTextScramble({ duration: 36 }))

  const on = ref(false)
  let timers: ReturnType<typeof setTimeout>[] = []
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
  const clearTimers = () => {
    timers.forEach(clearTimeout)
    timers = []
  }

  const play = () => {
    clearTimers()
    on.value = true
    // 線條由 CSS transition 依序畫出；文字等框線展開後才開始解碼
    coordScrambles.forEach((s, i) => later(400 + i * 150, () => s.setText(COORD[i]!)))
    codeScrambles.forEach((s, i) => later(900 + i * 180, () => s.setText(CODE[i]!)))
  }

  const reset = () => {
    clearTimers()
    on.value = false
    ;[...coordScrambles, ...codeScrambles].forEach((s) => s.setText(''))
  }

  onBeforeUnmount(clearTimers)

  defineExpose({ play, reset })
</script>

<template>
  <!-- 尺寸容器 = 場景框：文字以 cqw 換算，隨場景縮放 -->
  <div class="hud pointer-events-none absolute inset-0" :class="{ 'is-on': on }" aria-hidden="true">
    <svg viewBox="0 0 1182 1330" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible">
      <g fill="none" stroke="currentColor">
        <line
          v-for="(l, i) in lines"
          :key="i"
          class="draw"
          :style="{ '--d': `${i * 0.15}s` }"
          pathLength="1"
          :x1="l.x1"
          :y1="l.y1"
          :x2="l.x2"
          :y2="l.y2"
          stroke-width="1.2"
         
        />
        <path
          class="draw is-slow"
          :style="{ '--d': '0.2s' }"
          :d="arcPath"
          pathLength="1"
          stroke-width="1.2"
         
        />
        <g class="fade" :style="{ '--d': '0.9s' }">
          <line
            v-for="(t, i) in arcTicks"
            :key="i"
            :x1="t.x1"
            :y1="t.y1"
            :x2="t.x2"
            :y2="t.y2"
            stroke-width="1.2"
           
          />
        </g>
      </g>
      <!-- 準星：依序由中心放大閃現，第一個持續緩慢閃爍 -->
      <g
        v-for="(c, i) in crosses"
        :key="i"
        class="cross"
        :class="{ 'is-blink': i === 0 }"
        :style="{ '--d': `${0.4 + i * 0.09}s`, transformOrigin: `${c.x}px ${c.y}px` }"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <line :x1="c.x - 9" :y1="c.y" :x2="c.x + 9" :y2="c.y" />
        <line :x1="c.x" :y1="c.y - 9" :x2="c.x" :y2="c.y + 9" />
      </g>
    </svg>

    <!-- 左上：座標 + 橘色短線 + 三個狀態點 -->
    <div class="coord absolute">
      <p v-for="(s, i) in coordScrambles" :key="i" class="min-h-[1.3em]" v-html="s.output.value"></p>
      <span class="accent fade-x" :style="{ '--d': '0.3s' }"></span>
    </div>
    <div class="dots absolute flex flex-col">
      <span v-for="i in 3" :key="i" class="dot fade" :style="{ '--d': `${0.5 + i * 0.12}s` }"></span>
    </div>

    <!-- 右上：程式碼框（框線由左往右展開，程式碼逐行解碼） -->
    <div class="code absolute">
      <span class="code-frame fade-x" :style="{ '--d': '0.5s' }"></span>
      <span class="code-bar fade-x" :style="{ '--d': '0.7s' }"></span>
      <pre class="relative"><span
        v-for="(s, i) in codeScrambles"
        :key="i"
        class="block min-h-[1.45em]"
        v-html="s.output.value"
      ></span></pre>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .hud {
    container-type: size;
    color: #fff;
  }

  /* 線條畫出：pathLength=1，dashoffset 1 → 0；收回時不延遲、較快 */
  .draw {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    opacity: 0.55;
    transition: stroke-dashoffset 0.4s ease-in;
  }

  .fade,
  .cross {
    opacity: 0;
    transition: opacity 0.3s;
  }

  .cross {
    scale: 0;
    transition:
      opacity 0.3s,
      scale 0.3s;
  }

  .fade-x {
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease-in;
  }

  .is-on {
    .draw {
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 1.2s cubic-bezier(0.65, 0, 0.35, 1) var(--d, 0s);

      &.is-slow {
        transition-duration: 1.8s;
      }
    }

    .fade {
      opacity: 0.45;
      transition: opacity 0.6s var(--d, 0s);
    }

    .cross {
      opacity: 0.8;
      scale: 1;
      transition:
        opacity 0.2s var(--d, 0s),
        scale 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d, 0s);

      &.is-blink {
        animation: blink 1.6s steps(1) 1.4s infinite;
      }
    }

    .fade-x {
      transform: scaleX(1);
      transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0s);
    }
  }

  @keyframes blink {
    50% {
      opacity: 0.15;
    }
  }

  /* 文字以場景寬換算（cqw），與原圖比例一致。
     位置避開第三幕前景內容：座標在左側標題與技能表之間、程式碼框在主角頭部右側（兩欄內容的空隙） */
  .coord {
    left: 7%;
    top: 38%;
    font-size: max(9px, 0.95cqw);
    line-height: 1.3;
    letter-spacing: 0.06em;
    opacity: 0.8;
  }

  .accent {
    position: absolute;
    left: calc(100% + 1.2em);
    top: 0.55em;
    width: 2.6em;
    height: 2px;
    background: #ff6a1a;
  }

  .dots {
    left: 5.4%;
    top: 38.4%;
    gap: 0.9cqw;
  }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #fff;
  }

  .code {
    left: 41%;
    top: 30%;
    width: 18%;
    opacity: 0.75;
    padding: 0.9cqw 1.1cqw;
    font-size: max(9px, 0.95cqw);
    line-height: 1.45;
  }

  /* 程式碼框：深色底 + 細框，由左往右展開 */
  .code-frame {
    position: absolute;
    inset: 0;
    background: rgb(10 10 12 / 0.4);
    border: 1px solid rgb(255 255 255 / 0.22);
  }

  /* 框頂的藍色細條（呼應原圖的藍色點綴） */
  .code-bar {
    position: absolute;
    left: 0;
    top: -1px;
    width: 38%;
    height: 2px;
    background: #3d6af2;
  }

  pre {
    margin: 0;
    font-family: inherit;
    white-space: pre;
    opacity: 0.9;
  }

  :deep(.scramble-dud) {
    opacity: 0.6;
  }

  @media (prefers-reduced-motion: reduce) {
    .is-on .cross.is-blink {
      animation: none;
    }
  }
</style>
