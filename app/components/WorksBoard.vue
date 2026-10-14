<script setup lang="ts">
  import { ref } from 'vue'
  import type gsap from 'gsap'
  // TODO: 換成作品的第二張截圖（右下角小縮圖）
  import thumbPic from '@/assets/images/main.png'

  /**
   * WorksBoard：第四幕「精選作品」。
   * 第三幕的滿版背景會反向翻轉、縮進中央的 slot 成為作品卡片（由 index.vue 量測 slotRect() 決定落點）；
   * 左側巨型直排字、右側作品資訊與規格尺規，則由 addTo() 把捲動補間接進主 timeline。
   */

  // TODO: 換成實際作品內容（url 有值時才顯示外部連結）
  const work = {
    index: '01',
    title: 'Interactive Portfolio',
    desc: 'A scroll-driven storytelling site built with Nuxt — 3D card flips, parallax scenes and text-scramble effects choreographed on a single GSAP timeline.',
    specs: [
      { label: 'Role', value: 'Design & Front-End' },
      { label: 'Stack', value: 'Nuxt · GSAP · Tailwind' },
      { label: 'Focus', value: 'Motion & Interaction' },
      { label: 'Year', value: '2026' }
    ],
    url: ''
  }

  const bigText = 'WORKS'
  const { output: titleOutput, setText } = useTextScramble({ duration: 40 })

  const root = ref<HTMLElement | null>(null)
  const bigEl = ref<HTMLElement | null>(null)
  const slotEl = ref<HTMLElement | null>(null)
  const introWrap = ref<HTMLElement | null>(null)
  const lineEls = ref<HTMLElement[]>([])
  const specEls = ref<HTMLElement[]>([])
  const thumbEl = ref<HTMLElement | null>(null)

  // 作品卡片落點（視窗座標）：index.vue 以此決定滿版背景縮進的位置與尺寸
  const slotRect = () => slotEl.value!.getBoundingClientRect()

  // 把本幕的捲動補間接到主 timeline 的 at 位置（at 約為背景翻到側面、切換成作品卡片的時間點）
  const addTo = (tl: gsap.core.Timeline, at: number) => {
    tl
      // 整塊顯現
      .fromTo(root.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, at)
      // 巨型直排字：由下方滑入並淡入
      .fromTo(
        bigEl.value,
        { autoAlpha: 0, yPercent: 40 },
        { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'power2.out' },
        at
      )
      // 右側標籤 / 標題 / 說明依序浮現
      .fromTo(
        introWrap.value ? [...introWrap.value.children] : [],
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 },
        at + 0.2
      )
      // 規格尺規：橫線由左往右畫出，數值隨後浮現
      .fromTo(lineEls.value, { scaleX: 0 }, { scaleX: 1, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, at + 0.35)
      .fromTo(specEls.value, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.08 }, at + 0.5)
      // 右下小縮圖：由下往上揭開
      .fromTo(
        thumbEl.value,
        { autoAlpha: 0, clipPath: 'inset(100% 0 0 0)' },
        { autoAlpha: 1, clipPath: 'inset(0% 0 0 0)', duration: 0.5, ease: 'power2.out' },
        at + 0.6
      )
  }

  const enter = () => setText(work.title) // 作品標題亂數解碼進場
  const leave = () => setText('') // 標題亂碼解散

  defineExpose({ addTo, enter, leave, slotRect })
</script>

<template>
  <!-- 初始 invisible：在主 timeline 建立前（loading 期間）保持隱藏，避免閃現 -->
  <section ref="root" class="invisible absolute inset-0 pointer-events-none">
    <!-- 行動版：巨型字 → 作品卡片 → 作品資訊（上下堆疊）；桌機版：左 2 / 中 6 / 右 4 欄 -->
    <div class="h-full flex flex-col md:grid md:grid-cols-12">
      <!-- 巨型字：行動版橫排置頂，桌機版直排（由下往上讀）貼齊左欄底部 -->
      <div class="overflow-hidden px-4 pt-3 md:col-span-2 md:p-0 md:flex md:items-end md:justify-center">
        <!-- 外層負責直排旋轉（CSS），內層由 gsap 做位移，避免兩者 transform 互相覆蓋 -->
        <p class="big-text text-6xl font-bold leading-none md:text-[min(22vh,12vw)] md:pb-4">
          <span ref="bigEl" class="inline-block">{{ bigText }}</span>
        </p>
      </div>

      <!-- 作品卡片落點：不可見的定位參考，滿版背景會翻轉縮進這裡 -->
      <div class="flex flex-1 min-h-0 items-center justify-center p-4 md:col-span-6 md:p-6">
        <div ref="slotEl" class="w-full max-h-full aspect-4/3 md:w-auto md:h-[72%] md:aspect-4/5"></div>
      </div>

      <!-- 作品資訊 -->
      <div class="s-line flex flex-col gap-4 p-4 md:col-span-4 md:justify-between md:border-l-[0.5px] md:p-6">
        <div ref="introWrap">
          <p class="flex justify-between text-xs tracking-widest opacity-70">
            <span>[ 03 ] SELECTED WORKS</span>
            <span>{{ work.index }} / 01</span>
          </p>
          <!-- 預留兩行高度：標題為亂碼解碼（初始為空），避免解碼後撐高版面、讓已量測的卡片落點偏移 -->
          <h2 class="mt-3 min-h-[2em] text-2xl lg:text-4xl uppercase leading-none" v-html="titleOutput"></h2>
          <p class="mt-3 text-xs md:text-sm leading-relaxed opacity-80">{{ work.desc }}</p>
        </div>

        <!-- 規格尺規：每列一條由左往右畫出的橫線 -->
        <ul class="space-y-2.5">
          <li v-for="spec in work.specs" :key="spec.label" class="relative pb-2 text-xs">
            <div ref="specEls" class="flex justify-between">
              <span class="opacity-60 uppercase tracking-widest">{{ spec.label }}</span>
              <span>{{ spec.value }}</span>
            </div>
            <span ref="lineEls" class="ruler absolute inset-x-0 bottom-0 h-px origin-left"></span>
          </li>
        </ul>

        <!-- 右下小縮圖（行動版與矮螢幕隱藏） -->
        <div ref="thumbEl" class="hidden md:block [@media(max-height:760px)]:hidden">
          <TechFrame
            :strokeWidth="0"
            :bottom-left="{ type: 'notch', size: '40%', depth: '10px', radius: '4px' }"
            class="aspect-video"
          >
            <img :src="thumbPic" alt="work preview" />
          </TechFrame>
          <a
            v-if="work.url"
            :href="work.url"
            target="_blank"
            rel="noopener noreferrer"
            class="pointer-events-auto mt-2 inline-flex items-center gap-1 text-xs hover:underline"
          >
            View project <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
  /* 分隔線與 Panel 共用主題變數（scoped 樣式不會繼承 Panel 的 .p-line） */
  .s-line {
    border-color: var(--panel-line, rgb(0 0 0 / 0.5));
  }

  /* 尺規線：主線 + 每 10% 一格的刻度 */
  .ruler {
    background:
      repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 10%) bottom / 100% 5px no-repeat,
      linear-gradient(currentColor, currentColor) bottom / 100% 1px no-repeat;
    height: 5px;
    opacity: 0.5;
  }

  /* 桌機版巨型字改為直排，並旋轉 180° 讓文字由下往上閱讀 */
  @media (min-width: 768px) {
    .big-text {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
    }
  }

  :deep(.scramble-dud) {
    opacity: 0.7;
  }
</style>
