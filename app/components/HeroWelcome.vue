<script setup lang="ts">
  /**
   * HeroWelcome：第一幕「WELCOME」前後景文字（Photoshop 常見的「字穿過人物」效果）。
   * 同一組字放兩層，夾住主角去背圖：
   *   - back：實心字，墊在主角背後，被主角遮住；進場時由下往上滑出（line reveal）
   *   - front：同位置的細外框字，疊在主角上方；進場時沿字形描線畫出
   * 定位：.cover 以 container query 重現主視覺的 object-cover 範圍，字以原圖比例錨定在主角身上；
   * 字寬取「原圖比例寬」與「視窗寬上限」較小者，窄視窗時字會縮小而不被裁切、也不壓到兩側內容。
   * 進場由父層在開場 loading 結束後把 on 設為 true；捲動退場由 index.vue 的主 timeline 控制外層。
   */

  const props = defineProps<{ layer: 'back' | 'front'; on: boolean }>()

  // 字形畫布：寬 = 字串寬（textLength 固定，不受字型寬度影響），高 = 字級；基線在 BASELINE 處
  const WORD_W = 1150
  const WORD_H = 250
  const BASELINE = 0.85

  // 各斷點的構圖（以原圖的百分比表示）：x 為字的中心、y 為基線位置、w 為字寬、max 為字寬上限（視窗寬 cqw）
  // 桌機（banner1-pc 1672×941）：橫向帶狀穿過主角的上衣與外套；行動版（banner1-m 941×1672）：穿過主角的軀幹
  const LAYOUTS = [
    { key: 'pc', cls: 'max-md:hidden', ar: '1672 / 941', x: 50.8, y: 51, w: 58, max: 56 },
    { key: 'm', cls: 'md:hidden', ar: '941 / 1672', x: 50, y: 64, w: 65, max: 62 }
  ]
</script>

<template>
  <div
    class="welcome pointer-events-none absolute inset-0 overflow-hidden"
    :class="[`is-${props.layer}`, { 'is-on': props.on }]"
    aria-hidden="true"
  >
    <div v-for="l in LAYOUTS" :key="l.key" class="cover" :class="l.cls" :style="{ '--ar': l.ar }">
      <!-- SVG 預設裁切在自身範圍內：背景字進場前藏在基線下方即被裁掉 -->
      <svg
        class="word"
        :viewBox="`0 0 ${WORD_W} ${WORD_H}`"
        :style="{ left: `${l.x}%`, top: `${l.y}%`, width: `min(${l.w}%, ${l.max}cqw)` }"
      >
        <text
          class="welcome-text"
          :x="WORD_W / 2"
          :y="WORD_H * BASELINE"
          text-anchor="middle"
          :font-size="WORD_H"
          :textLength="WORD_W - 6"
          lengthAdjust="spacingAndGlyphs"
        >
          WELCOME
        </text>
      </svg>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .welcome {
    container-type: size;
  }

  /* 與主視覺 object-cover 相同的範圍：維持原圖比例、覆蓋整個容器並置中 */
  .cover {
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100cqw, 100cqh * var(--ar));
    aspect-ratio: var(--ar);
    translate: -50% -50%;
  }

  /* 以基線中心為錨點：top 為基線位置，往上移 85%（BASELINE）的字形畫布高 */
  .word {
    position: absolute;
    translate: -50% -85%;
    overflow: hidden;
  }

  .welcome-text {
    font-weight: 700;
  }

  /* 背景實心字：先藏在基線下（被 SVG 範圍裁切），進場時往上滑出 */
  .is-back .welcome-text {
    fill: #fff;
    opacity: 0.92;
    transform-box: fill-box;
    transform: translateY(105%);
    transition: transform 0.5s ease-in;
  }

  .is-back.is-on .welcome-text {
    transform: translateY(0);
    transition: transform 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.25s;
  }

  /* 前景外框字：以虛線位移描出字形；畫完後取消虛線，確保各瀏覽器最終都是完整外框 */
  .is-front .welcome-text {
    fill: none;
    stroke: #fff;
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-dasharray: 2400;
    stroke-dashoffset: 2400;
  }

  .is-front.is-on .welcome-text {
    animation: welcome-draw 2.4s cubic-bezier(0.65, 0, 0.35, 1) 0.9s forwards;
  }

  @keyframes welcome-draw {
    99% {
      stroke-dasharray: 2400;
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dasharray: none;
      stroke-dashoffset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .is-back.is-on .welcome-text {
      transition: none;
    }

    .is-front.is-on .welcome-text {
      animation: none;
      stroke-dasharray: none;
      stroke-dashoffset: 0;
    }
  }
</style>
