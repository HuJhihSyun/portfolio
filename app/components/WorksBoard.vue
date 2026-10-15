<script setup lang="ts">
  import { ref } from 'vue'
  import type gsap from 'gsap'
  // 作品截圖：一次載入 assets/images/works-*.jpg，以檔名（不含副檔名）取用；新增作品圖只要依命名放入資料夾即可
  const workImages = import.meta.glob<string>('../assets/images/works-*.jpg', { eager: true, import: 'default' })
  const img = (name: string) => workImages[`../assets/images/${name}.jpg`] ?? ''

  /**
   * WorksBoard：第四幕「精選作品」。
   * 第三幕的滿版背景會反向翻轉、縮向中央的輪播區（由 index.vue 量測 slotRect() 決定落點），翻到側面時消失、由輪播接手；
   * 輪播為兩列作品卡片（圖片連結），隨捲動往相反方向位移：桌機版為左右兩欄上下移動，行動版為上下兩排左右移動。
   * 左側巨型字、右側區塊說明與規格尺規、輪播位移，皆由 addTo() 把捲動補間接進主 timeline。
   */

  interface Work {
    type: 'web' | 'graphic' // 網頁作品排左欄（行動版上排）、平面作品排右欄（下排）
    title: string
    category: string
    year?: string // 年份（圖上可辨識者才填）
    image: string
    url?: string // 作品連結（有值時卡片可點擊、另開分頁）
  }

  // 作品清單：依 type 分入兩列輪播（網頁 / 平面各一列），同類型內依清單順序排列
  // TODO: 補上各作品連結（url）與缺少的年份；標題 / 分類依圖面內容撰寫，可再自行修正
  const works: Work[] = [
    {
      type: 'web',
      title: 'Home Pest Defense',
      category: 'Web · Campaign Site',
      image: img('works-web-1'),
      url: 'https://accessus.cloud/basf/house/index.html'
    },
    {
      type: 'graphic',
      title: 'Inkjet Printer Brochure',
      category: 'Graphic · Print',
      image: img('works-graphic-1'),
      url: 'https://www.behance.net/gallery/157699859/-DM'
    },
    {
      type: 'web',
      title: 'BASF Interactive Experience',
      category: 'Web · Interactive',
      image: img('works-web-2'),
      url: 'https://crop-protection.basf.tw/rice-solution/'
    },
    {
      type: 'graphic',
      title: 'HP Parenthood Care Program',
      category: 'Graphic · EDM',
      image: img('works-graphic-2'),
      url: 'https://www.behance.net/gallery/148729665/-2019-x-FUN-'
    },
    {
      type: 'web',
      title: 'Wanli Crab Online Exhibition',
      category: 'Web · Online Exhibition',
      image: img('works-web-3'),
      url: 'https://www.behance.net/gallery/129157533/wanli-crab-10th-anniversary-exhibition'
    },
    {
      type: 'graphic',
      title: 'Take Our Children to Work',
      category: 'Graphic · Event Agenda',
      year: '2019',
      image: img('works-graphic-3'),
      url: 'https://www.behance.net/gallery/148205879/-Take-Our-Children-to-Work-DM'
    },
    {
      type: 'web',
      title: 'Aruba Central — Work Anywhere',
      category: 'Web · Campaign Site',
      image: img('works-web-4'),
      url: 'https://accessus.cloud/Aruba/202110-Aruba-web-island-rescue/index.html'
    },
    {
      type: 'graphic',
      title: 'Forge Workshop & BIM Forum',
      category: 'Graphic · Event EDM',
      year: '2020',
      image: img('works-graphic-4'),
      url: 'https://www.behance.net/gallery/148195493/-Forge-'
    },
    {
      type: 'web',
      title: 'Imagination Consultancy',
      category: 'Web · Responsive',
      image: img('works-web-5'),
      url: 'https://www.behance.net/gallery/121244725/-()'
    },
    {
      type: 'graphic',
      title: 'HP Summer Fat-Burning Challenge',
      category: 'Graphic · EDM',
      year: '2019',
      image: img('works-graphic-5'),
      url: 'https://www.behance.net/gallery/147958027/-2019-Well-Beyond-Event-'
    },
    {
      type: 'web',
      title: 'NTPU Admission Site',
      category: 'Web · Responsive',
      year: '2019',
      image: img('works-web-6'),
      url: 'https://www.behance.net/gallery/114312609/_'
    },
    {
      type: 'graphic',
      title: 'Global Wellness Challenge',
      category: 'Graphic · Campaign Visual',
      image: img('works-graphic-6'),
      url: 'https://www.behance.net/gallery/129019039/-2020-Global-Wellness-Challenge-ver2'
    },
    {
      type: 'web',
      title: 'Eden Foundation',
      category: 'Web · Illustrated Site',
      image: img('works-web-7'),
      url: 'https://wanfuartgallery.eden.org.tw/'
    },
    {
      type: 'graphic',
      title: "Let's Workout",
      category: 'Graphic · Campaign Visual',
      image: img('works-graphic-7'),
      url: 'https://www.behance.net/gallery/122402577/-2020-Global-Wellness-Challenge-'
    },
    {
      type: 'graphic',
      title: 'HP Power of Prevention',
      category: 'Graphic · EDM',
      year: '2020',
      image: img('works-graphic-8'),
      url: 'https://www.behance.net/gallery/119329421/-2020-Power-of-Prevention-'
    }
  ]

  // 每列重複排列的次數：卡片總長需明顯超出輪播區才有足夠位移距離（作品數夠多時維持 1 即可）
  const REPEAT = 1
  const buildTrack = (type: Work['type']) =>
    Array.from({ length: REPEAT }, (_, r) =>
      works
        .filter((work) => work.type === type)
        .map((work, i) => ({ ...work, key: `${r}-${type}-${i}`, duplicate: r > 0 }))
    ).flat()
  const trackA = buildTrack('web')
  const trackB = buildTrack('graphic')

  const summary = {
    title: 'Selected Works',
    desc: 'Campaign sites, interactive web experiences and graphic design for brands and organizations. Scroll to browse the selection.',
    specs: [
      { label: 'Projects', value: `${String(works.length).padStart(2, '0')}` },
      { label: 'Fields', value: 'Web · Campaign · Graphic' },
      { label: 'Stack', value: 'Vue · Nuxt · GSAP' },
      { label: 'Since', value: '2017' }
    ]
  }

  const bigText = 'WORKS'
  const sectionNo = '03' // 區塊編號：巨型字旁的小數字與右側標籤共用
  const { output: titleOutput, setText } = useTextScramble({ duration: 40 })

  const root = ref<HTMLElement | null>(null)
  const bigEl = ref<HTMLElement | null>(null)
  const slotEl = ref<HTMLElement | null>(null)
  const viewportEl = ref<HTMLElement | null>(null)
  // 兩列輪播軌道（以 index 對應，v-for 內的 ref 陣列不保證順序）
  const trackEls: HTMLElement[] = []
  const introWrap = ref<HTMLElement | null>(null)
  const lineEls = ref<HTMLElement[]>([])
  const specEls = ref<HTMLElement[]>([])

  // 輪播區落點（視窗座標）：index.vue 以此決定滿版背景縮向的位置與尺寸
  const slotRect = () => slotEl.value!.getBoundingClientRect()

  // 把本幕的捲動補間接到主 timeline 的 at 位置（at 約為背景翻到側面消失、由輪播接手的時間點）。
  // scrollLen：輪播位移的長度（timeline 時間單位）；isMobile：行動版改為橫向輪播
  const addTo = (tl: gsap.core.Timeline, at: number, scrollLen: number, isMobile = false) => {
    // 每列可位移的距離 = 卡片總長 − 輪播區可視範圍（以函式值量測，搭配 invalidateOnRefresh 在 resize 時重新計算）
    const travel = (track: HTMLElement | null) => () => {
      const view = viewportEl.value
      if (!view || !track) return 0
      return isMobile
        ? Math.max(0, track.offsetWidth - view.clientWidth)
        : Math.max(0, track.offsetHeight - view.clientHeight)
    }
    const travelA = travel(trackEls[0] ?? null)
    const travelB = travel(trackEls[1] ?? null)
    const axis = isMobile ? 'x' : 'y'
    const moveAt = at + 0.6

    tl
      // 整塊顯現
      .fromTo(root.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, at)
      // 巨型字：由下方滑入並淡入
      .fromTo(
        bigEl.value,
        { autoAlpha: 0, yPercent: 40 },
        { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'power2.out' },
        at
      )
      // 輪播：由中線向上下展開
      .fromTo(
        viewportEl.value,
        { autoAlpha: 0, clipPath: 'inset(50% 0% 50% 0%)' },
        { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'power2.out' },
        at + 0.1
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
      // 兩列往相反方向輪播：A 列由起點往前推進、B 列由終點往回推進
      .fromTo(trackEls[0]!, { [axis]: 0 }, { [axis]: () => -travelA(), duration: scrollLen }, moveAt)
      .fromTo(trackEls[1]!, { [axis]: () => -travelB() }, { [axis]: 0, duration: scrollLen }, moveAt)
  }

  const enter = () => setText(summary.title) // 區塊標題亂數解碼進場
  const leave = () => setText('') // 標題亂碼解散

  defineExpose({ addTo, enter, leave, slotRect })
</script>

<template>
  <!-- 初始 invisible：在主 timeline 建立前（loading 期間）保持隱藏，避免閃現 -->
  <section ref="root" class="invisible absolute inset-0 pointer-events-none">
    <!-- 行動版：巨型字 → 作品輪播 → 區塊資訊（上下堆疊）；桌機版：左 2 / 中 6 / 右 4 欄 -->
    <div class="h-full flex flex-col md:grid md:grid-cols-12">
      <!-- 巨型字：行動版橫排置頂，桌機版直排（由下往上讀）貼齊左欄底部 -->
      <div class="overflow-hidden px-4 pt-3 md:col-span-2 md:p-0 md:flex md:items-end md:justify-center">
        <!-- 外層負責直排旋轉（CSS），內層由 gsap 做位移，避免兩者 transform 互相覆蓋 -->
        <!-- 字體比照第一幕大標題（Quantico 一般字重 + 字前小數字）；桌機直排時小數字隨之落在字首（下方）外側 -->
        <!-- 桌機版整段旋轉 180°，md:pt-4 實際呈現在下方，讓字首的小數字與底邊保留間距、不被裁切 -->
        <p class="big-text text-[clamp(2.75rem,16vw,3.75rem)] leading-none md:text-[min(22vh,10vw)] md:pt-4 md:mb-6">
          <span ref="bigEl" class="inline-block"
            ><sup class="text-xs md:text-lg lg:text-xl">{{ sectionNo }}</sup
            >{{ bigText }}</span
          >
        </p>
      </div>

      <!-- 輪播區：滿版背景翻轉縮向這裡後消失，由兩列作品卡片接手 -->
      <div class="flex flex-1 min-h-0 items-center justify-center p-4 md:col-span-6 md:p-6">
        <div ref="slotEl" class="relative w-full h-full md:max-w-140">
          <div
            ref="viewportEl"
            class="carousel absolute inset-0 grid grid-rows-2 gap-3 overflow-hidden p-3 md:grid-rows-none md:grid-cols-2"
          >
            <!-- md:self-start：軌道高度只取自身卡片總長（不被 grid 拉成等高），兩列卡片數不同時位移量才正確 -->
            <div
              v-for="(track, t) in [trackA, trackB]"
              :key="t"
              :ref="(el) => (trackEls[t] = el as HTMLElement)"
              class="flex h-full w-max gap-3 md:h-auto md:w-auto md:flex-col md:self-start"
            >
              <!-- 行動版：卡片寬度依輪播區高度換算（見 style），圖片下方另置說明文字、不壓在圖上；
                   桌機版：卡片佔滿欄寬，說明於 hover 時由圖片底部滑入 -->
              <component
                :is="work.url ? 'a' : 'div'"
                v-for="work in track"
                :key="work.key"
                :href="work.url"
                :target="work.url ? '_blank' : undefined"
                :rel="work.url ? 'noopener noreferrer' : undefined"
                :aria-hidden="work.duplicate || undefined"
                :tabindex="work.duplicate ? -1 : undefined"
                class="work-card group pointer-events-auto flex shrink-0 flex-col md:block md:w-full"
              >
                <div class="relative aspect-5/4 w-full overflow-hidden rounded-md bg-neutral-800">
                  <img
                    :src="work.image"
                    :alt="work.title"
                    class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <!-- 桌機版：hover 時由下滑入的作品資訊 -->
                  <div
                    class="absolute inset-x-0 bottom-0 hidden translate-y-full bg-linear-to-t from-black/80 to-transparent p-3 pt-8 text-white transition-transform duration-300 group-hover:translate-y-0 md:block"
                  >
                    <p class="flex items-center justify-between text-xs font-bold">
                      <span>{{ work.title }}</span>
                      <span v-if="work.url" aria-hidden="true">↗</span>
                    </p>
                    <p class="mt-0.5 text-[10px] tracking-wide opacity-70">
                      {{ work.category }}<template v-if="work.year"> · {{ work.year }}</template>
                    </p>
                  </div>
                </div>
                <!-- 行動版：圖片下方的作品資訊（固定高度，供卡片尺寸換算） -->
                <div class="work-caption flex flex-col justify-center md:hidden">
                  <p class="flex items-center justify-between gap-2 text-xs font-bold">
                    <span class="truncate">{{ work.title }}</span>
                    <span v-if="work.url" aria-hidden="true">↗</span>
                  </p>
                  <p class="truncate text-[10px] tracking-wide opacity-70">
                    {{ work.category }}<template v-if="work.year"> · {{ work.year }}</template>
                  </p>
                </div>
              </component>
            </div>
          </div>
        </div>
      </div>

      <!-- 區塊資訊 -->
      <div class="s-line flex flex-col gap-4 p-4 md:col-span-4 md:justify-between md:border-l-[0.5px] md:p-6">
        <div ref="introWrap">
          <!-- 行動版縮小字距並禁止換行，避免標籤列折成兩行佔用輪播高度 -->
          <p
            class="flex justify-between gap-2 whitespace-nowrap text-[10px] tracking-wider opacity-70 md:text-xs md:tracking-widest"
          >
            <span>[ {{ sectionNo }} ] SELECTED WORKS</span>
            <span>{{ String(works.length).padStart(2, '0') }} PROJECTS</span>
          </p>
          <!-- 預留高度（行動版一行、桌機兩行）：標題為亂碼解碼（初始為空），避免解碼後撐高版面、讓已量測的輪播區落點偏移；
               行動版矮螢幕隱藏（與上方標籤重複），把高度讓給輪播 -->
          <h2
            class="mt-3 min-h-[1em] md:min-h-[2em] max-md:[@media(max-height:700px)]:hidden text-2xl lg:text-4xl uppercase leading-none"
            v-html="titleOutput"
          ></h2>
          <!-- 行動版矮螢幕隱藏說明，把高度讓給輪播 -->
          <p class="mt-3 text-xs md:text-sm leading-relaxed opacity-80 max-md:[@media(max-height:700px)]:hidden">
            {{ summary.desc }}
          </p>
        </div>

        <!-- 規格尺規：每列一條由左往右畫出的橫線（行動版隱藏，把高度讓給輪播） -->
        <ul class="hidden space-y-2.5 md:block">
          <li v-for="spec in summary.specs" :key="spec.label" class="relative pb-2 text-xs">
            <div ref="specEls" class="flex justify-between">
              <span class="opacity-60 uppercase tracking-widest">{{ spec.label }}</span>
              <span>{{ spec.value }}</span>
            </div>
            <span ref="lineEls" class="ruler absolute inset-x-0 bottom-0 h-px origin-left"></span>
          </li>
        </ul>
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

  /* 行動版：輪播區作為尺寸容器，卡片依其高度換算，讓兩排「圖片 + 說明」剛好填滿輪播區（不同手機高度皆適用）。
     圖片高 = (輪播區高 − 上下內距 24px − 兩排間距 12px) ÷ 2 − 說明高；卡片寬 = 圖片高 × 5/4 */
  @media (max-width: 767px) {
    .carousel {
      container-type: size;
    }

    .work-card {
      --caption-h: 40px;
      width: calc(((100cqh - 36px) / 2 - var(--caption-h)) * 1.25);
    }

    .work-caption {
      height: var(--caption-h);
    }
  }

  @media (min-width: 768px) {
    /* 桌機版輪播上下邊緣淡出，讓卡片自然地進出輪播區（行動版不加，避免遮住圖片） */
    .carousel {
      mask-image: linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent);
    }

    /* 桌機版巨型字改為直排，並旋轉 180° 讓文字由下往上閱讀 */
    .big-text {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
    }
  }

  :deep(.scramble-dud) {
    opacity: 0.7;
  }
</style>
