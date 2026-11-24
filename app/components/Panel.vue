<script setup lang="ts">
  import { ref, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import type gsap from 'gsap'
  import aboutPic from '@/assets/images/about.webp'

  // 頂部選單：點擊後通知父層（index.vue）捲到對應區塊（key 對應 index.vue 的 sectionTimes）
  type SectionKey = 'about' | 'skills' | 'works' | 'contact'
  const emit = defineEmits<{ navigate: [key: SectionKey] }>()
  const menuList: { label: string; key: SectionKey }[] = [
    { label: 'About', key: 'about' },
    { label: 'Skills', key: 'skills' },
    { label: 'Works', key: 'works' },
    { label: 'Contact', key: 'contact' }
  ]

  const profileText = `Senior Front-End Engineer & Designer with 5+ years of experience specializing in the Vue ecosystem (Vue/Nuxt) and high-performance e-commerce platforms. Expert in blending design with code to build immersive, interactive web experiences using GSAP and D3.js. Proven track record in optimizing web performance (LCP/CLS) and delivering scalable architectures from concept to deployment.`
  const profileText2 = `My journey into web development began at the intersection of aesthetics and logic. Early in my career, I acted as both a visual designer and front-end developer, mastering the art of storytelling through engaging interactions and rich animations with GSAP and D3.js. This dual perspective instilled in me a deep sensitivity to user experience that continues to guide my engineering decisions today.`

  const { output: profileOutput, setText } = useTextScramble({ duration: 40 })
  // aboutText 專用的第二組 Text Scramble（顯示 profileText2）；初始為空，下捲才解碼呈現
  const { output: aboutOutput, setText: setAboutText } = useTextScramble({ duration: 40 })

  // 角色卡片的 hover 3D 傾斜（套在 TechFrame 內的 img，避免與卡片翻開的 gsap transform 衝突）
  const { tiltStyle: characterTilt } = useTilt({ max: 5, scale: 1.06 })

  const mainTitle = reactive([{ text: 'Code.' }, { text: 'Design.' }, { text: 'Interact.' }])

  // 開場進場狀態：初始隱藏（左上文字為空、右下標題不播 line-reveal）。
  // 等 index.vue 的開場 loading 結束後呼叫 enter() 才播進場，才能與 loading 正常銜接。
  const entered = ref(false)
  const enter = () => {
    entered.value = true
    setText(profileText) // 左上 profile 文字亂數解碼進場
  }

  // 由 index.vue 的 ScrollTrigger 觸發：左上 article 的亂碼往空字串解散 / 還原成原文
  const scrambleOut = () => setText('')
  const scrambleIn = () => setText(profileText)

  // 右下 line-reveal 標題的退場狀態：true 時套用 .is-exiting（橫條再次劃過、文字淡出消失）
  const exiting = ref(false)
  // 第一幕捲動提示徽章：離開第一幕時停轉，捲回時復原（點擊後放大淡出的狀態也一併還原）
  const scrollBadge = ref<{ reset: () => void; play: () => void; pause: () => void } | null>(null)
  // 下捲：播退場動畫
  const revealOut = () => {
    exiting.value = true
    scrollBadge.value?.pause()
  }
  // 回捲：移除 class，還原成進場後的可見狀態
  const revealIn = () => {
    exiting.value = false
    scrollBadge.value?.reset()
    scrollBadge.value?.play()
  }

  // 右側區塊（第二畫面）：nameWrap 的 Block Reveal 進退場狀態 + aboutText 的 Scramble
  const nameState = ref<'hidden' | 'in' | 'out'>('hidden') // hidden=初始隱藏、in=進場、out=退場
  const aboutIn = () => {
    nameState.value = 'in' // nameWrap 播 Block Reveal 進場
    setAboutText(profileText2) // aboutText 以亂數解碼呈現 profileText2
  }
  const aboutOut = () => {
    nameState.value = 'out' // nameWrap 播 Block Reveal 退場
    setAboutText('') // aboutText 亂數解散成空
  }

  // 第三幕：技能矩陣 + 時間軸（捲動補間由 index.vue 的主 timeline 透過 skills.addTo() 接入）
  const skills = ref<{
    addTo: (tl: gsap.core.Timeline, at: number, isMobile?: boolean, unitPx?: number) => void
    addOutro: (tl: gsap.core.Timeline, holdAt: number, outAt: number, isMobile?: boolean) => void
    enter: () => void
    leave: () => void
  } | null>(null)

  // 第四幕：精選作品（輪播外框落點 + 捲動補間，由 index.vue 的主 timeline 透過 works.addTo() 接入）
  const works = ref<{
    addTo: (tl: gsap.core.Timeline, at: number, scrollLen: number, isMobile?: boolean) => void
    addOutro: (tl: gsap.core.Timeline, at: number) => void
    enter: () => void
    leave: () => void
    slotRect: () => DOMRect
  } | null>(null)

  // 第五幕：聯絡 / Footer（捲動補間由 index.vue 的主 timeline 透過 contact.addTo() 接入）
  const contact = ref<{
    addTo: (tl: gsap.core.Timeline, at: number, unitPx?: number) => void
    enter: () => void
    leave: () => void
  } | null>(null)

  // 環狀文字（第四幕右欄 → 第五幕底部）：放在 Panel 層而非 WorksBoard 內，第四幕退場淡出時才不會一起消失。
  // 位置 / 尺寸 / 傾斜由 index.vue 的主 timeline 補間
  const ring = ref<{ play: () => void; pause: () => void; setInteractive: (value: boolean) => void } | null>(null)

  // 右側直欄的頁面進度條在共用外框 PanelShell 內，由 index.vue 在主 timeline 更新時經此轉呼叫
  const shell = ref<{ setProgress: (progress: number) => void } | null>(null)
  const setProgress = (progress: number) => shell.value?.setProgress(progress)

  // 暴露給父層（index.vue）呼叫
  defineExpose({
    setProgress,
    enter,
    scrambleOut,
    scrambleIn,
    revealOut,
    revealIn,
    aboutIn,
    aboutOut,
    skills,
    works,
    contact,
    ring
  })
</script>

<template>
  <!-- 外框（頂列 / 右側直欄 / 側選單）由 PanelShell 共用；這裡只放首頁五幕的內容 -->
  <PanelShell ref="shell" :items="menuList" @navigate="(key) => emit('navigate', key)">
    <!-- overflow-clip（而非 hidden）：第五幕表單欄位取得焦點時，瀏覽器不會自行捲動 main 而打亂 timeline 控制的版面 -->
    <main ref="mainEl" class="relative w-full h-full overflow-clip">
      <!-- 第一幕：行動版文字與標題改為滿寬，上下分置避免重疊。
           外層 headerText 由 index.vue 控制淡出（文字與捲動提示徽章一起退場）；relative z-10 讓徽章疊在第二幕的透明元素之上、可被點擊 -->
      <div ref="headerText" class="relative z-10 w-full md:w-1/2">
        <article
          class="hero-shadow leading-relaxed text-sm md:leading-normal p-4 md:p-6"
          v-html="profileOutput"
        ></article>
        <!-- 捲動提示徽章：點擊後捲到第二幕（About）；徽章本身在 loading 結束、文字解碼時一起淡入 -->
        <!-- 進場淡入放在外層：避免 CSS transition 干擾徽章點擊時 gsap 的放大淡出 -->
        <div
          class="badge-in ml-4 w-fit md:ml-6 max-md:[@media(max-height:700px)]:hidden"
          :class="{ 'is-entered': entered }"
        >
          <AtomsScrollBadge ref="scrollBadge" class="size-28 md:size-32" @click="emit('navigate', 'about')" />
        </div>
      </div>
      <article
        class="hero-shadow absolute flex flex-col items-end right-0 bottom-0 w-full md:w-1/2 text-5xl md:text-7xl lg:text-8xl [@media(max-height:500px)]:text-5xl text-right p-4 md:p-6 leading-none"
      >
        <h2
          v-for="(item, index) in mainTitle"
          :key="item.text"
          class="line-reveal"
          :class="{ 'is-entering': entered, 'is-exiting': exiting }"
          :style="`--i: ${index}`"
        >
          <span class="line-reveal-text"
            ><sup class="text-xs md:text-sm lg:text-base">0{{ index + 1 }}</sup
            >{{ item.text }}</span
          >
        </h2>
      </article>
      <!-- 第二幕角色欄：行動版置於左下（佔下方 58%，矮螢幕 45% 讓出空間給內文），桌機版為左側 1/3 滿高 -->
      <div
        ref="characterWrap"
        class="absolute left-0 bottom-0 hidden md:flex w-1/2 h-[58%] max-md:[@media(max-height:640px)]:h-[45%] border-t-[0.5px] border-r-[0.5px] p-line p-4 md:top-0 md:w-1/3 md:h-full md:border-t-0 md:p-6"
      >
        <!-- perspective 容器 + 卡片層：卡片以右緣為軸做 3D 翻開（由 index.vue 的 ScrollTrigger 驅動） -->
        <div class="w-full h-full perspective-distant">
          <div ref="characterCard" class="w-full h-full">
            <TechFrame
              :strokeWidth="0"
              :bottom-left="{ type: 'notch', size: '50%', depth: '24px', radius: '12px', orientation: 'vertical' }"
              class="w-full h-full"
            >
              <img :src="aboutPic" alt="about" class="will-change-transform" :style="{ transform: characterTilt }" />
            </TechFrame>
          </div>
        </div>
      </div>
      <!-- 第二幕右側區塊：行動版為上半部滿寬，桌機版為右側 2/3 -->
      <div ref="aboutWrap" class="absolute flex flex-col items-end right-0 top-0 w-full md:w-2/3">
        <div
          ref="nameWrap"
          class="w-full border-b-[0.5px] p-line px-4 md:px-6 py-3 flex justify-end text-2xl md:text-4xl lg:text-5xl"
        >
          <!-- Block Reveal：下捲時白色橫條劃過後名字顯現（由 nameState 控制進退場） -->
          <span
            class="scroll-reveal"
            :class="{ 'is-revealing': nameState === 'in', 'is-exiting': nameState === 'out' }"
          >
            <span class="scroll-reveal-text">JHIH-SYUN HU</span>
          </span>
        </div>
        <article
          ref="aboutText"
          class="w-full md:w-4/5 lg:w-3/5 leading-[1.6] text-sm md:leading-normal p-4 md:p-6"
          v-html="aboutOutput"
        ></article>
      </div>
      <!-- 第二幕背景小圖的落點（不可見的定位參考）：index.vue 量測此元素的位置與尺寸，把背景大圖縮放到這裡。行動版為右下直式卡片，桌機版對齊右側內文、350×200 橫式 -->
      <div
        ref="bgSlot"
        class="invisible absolute pointer-events-none right-4 bottom-4 w-[calc(100%-32px)] aspect-4/3 md:right-auto md:left-[calc(100%/3+24px)] md:bottom-6 md:w-87.5 md:h-50 md:aspect-auto"
      ></div>
      <SkillsBoard ref="skills" />
      <WorksBoard ref="works" />
      <!-- 環狀文字：排在 ContactBoard 之前，飛到第五幕後墊在聯絡內容底下。
           外層（ringFloat）負責位置、尺寸與傾斜角，內層（ringFade）負責第五幕時淡化成背景圖騰 -->
      <div ref="ringFloat" class="invisible absolute left-0 top-0 pointer-events-none">
        <div ref="ringFade">
          <AtomsTextRing
            ref="ring"
            text="Start a conversation"
            class="pointer-events-auto"
            @click="emit('navigate', 'contact')"
          />
        </div>
      </div>
      <ContactBoard ref="contact" />
    </main>
  </PanelShell>
</template>

<style lang="scss" scoped>
  /* 內部各分隔線 */
  .p-line {
    border-color: var(--panel-line, rgb(255 255 255 / 0.5));
  }

  /* 捲動提示徽章進場：loading 結束後（entered）與左上文字解碼同時淡入、由小放大 */
  .badge-in {
    opacity: 0;
    scale: 0.85;
    transition:
      opacity 0.8s ease 0.6s,
      scale 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.6s;

    &.is-entered {
      opacity: 1;
      scale: 1;
    }
  }

  /* 第一幕文字壓在主視覺上：加背景色陰影（近身陰影勾邊 + 大範圍柔光壓暗），避免與圖片重疊時看不清。
     陰影色取 --panel-bg，配色補間到第二幕時跟著反轉，不會在黑字周圍留下黑影 */
  .hero-shadow {
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--panel-bg, #000) 70%, transparent),
      0 0 16px color-mix(in srgb, var(--panel-bg, #000) 55%, transparent);
  }

  /* 讓亂碼中（尚未確定）的字元稍微變淡，強調雜訊感 */
  :deep(.scramble-dud) {
    opacity: 0.7;
  }

  /* Block Reveal：白色橫條由左而右劃過，經過後文字才顯現 */
  .line-reveal {
    position: relative;
    display: inline-block;

    /* 預設隱藏：文字透明、橫條收合，等 enter()（loading 結束後）才播進場 */
    &-text {
      opacity: 0;
    }

    &:after {
      content: '';
      position: absolute;
      inset: 0;
      transform: scaleX(0);
      transform-origin: left;
      background: var(--panel-fg, #fff);
    }

    /* 進場（開場 loading 結束後由 enter() 觸發）：橫條由左而右劃過、經過後文字顯現 */
    &.is-entering {
      .line-reveal-text {
        animation: reveal-text 0.01s linear forwards; /* 依 --i 錯開每一行的時間（0.4s 對應橫條完全蓋住文字的時點） */
        animation-delay: calc(var(--i) * 0.25s + 0.4s);
      }

      &:after {
        animation: bar-wipe 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        animation-delay: calc(var(--i) * 0.25s);
      }
    }

    /* 退場（下捲觸發）：橫條再次由左而右劃過，經過的瞬間文字淡出消失（Block Reveal 反向） */
    &.is-exiting {
      .line-reveal-text {
        opacity: 1;
        animation: reveal-text-out 0.8s linear forwards;
        animation-delay: calc(var(--i) * 0.25s);
      }

      /* 用獨立的 bar-wipe-out（動作同 bar-wipe），確保 animation-name 改變、退場橫條會重播 */
      &:after {
        animation: bar-wipe-out 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        animation-delay: calc(var(--i) * 0.25s);
      }
    }
  }

  /* Block Reveal（捲動觸發版）：與 line-reveal 相同，但進場改由 class 觸發、非掛載即播。
     初始為隱藏態（文字透明、橫條收合），下捲套 .is-revealing 進場、回捲套 .is-exiting 退場。 */
  .scroll-reveal {
    position: relative;
    display: inline-block;
    overflow: hidden;

    &-text {
      display: inline-block;
      opacity: 0; /* 初始隱藏，等橫條劃過才顯現 */
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: scaleX(0);
      transform-origin: left;
      background: var(--panel-fg, #fff);
    }

    /* 進場（下捲）：橫條由左而右劃過、經過後文字顯現 */
    &.is-revealing {
      .scroll-reveal-text {
        animation: reveal-text 0.01s linear forwards;
        animation-delay: 0.4s; /* 對應橫條完全蓋住文字的時點 */
      }

      &::after {
        animation: bar-wipe 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
      }
    }

    /* 退場（回捲）：橫條再劃過、經過的瞬間文字淡出 */
    &.is-exiting {
      .scroll-reveal-text {
        opacity: 1;
        animation: reveal-text-out 0.8s linear forwards;
      }

      &::after {
        animation: bar-wipe-out 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
      }
    }
  }

  /* 前半段：由左往右長出蓋住文字；後半段：改由右側收起，露出文字 */
  @keyframes bar-wipe {
    0% {
      transform: scaleX(0);
      transform-origin: left;
    }
    50% {
      transform: scaleX(1);
      transform-origin: left;
    }
    50.01% {
      transform-origin: right;
    }
    100% {
      transform: scaleX(0);
      transform-origin: right;
    }
  }

  @keyframes reveal-text {
    to {
      opacity: 1;
    }
  }

  /* 退場橫條：與 bar-wipe 動作相同，僅為了用不同 animation-name 強制重播 */
  @keyframes bar-wipe-out {
    0% {
      transform: scaleX(0);
      transform-origin: left;
    }
    50% {
      transform: scaleX(1);
      transform-origin: left;
    }
    50.01% {
      transform-origin: right;
    }
    100% {
      transform: scaleX(0);
      transform-origin: right;
    }
  }

  /* 橫條蓋住的瞬間（50%）文字淡出 */
  @keyframes reveal-text-out {
    0%,
    45% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }

  /* step-2 進場：由左而右揭開（clip-path）並淡入 */
  .step-2 {
    animation: step2-in 0.6s cubic-bezier(0.7, 0, 0.3, 1) forwards;
  }

  @keyframes step2-in {
    from {
      opacity: 0;
      clip-path: inset(0 100% 0 0);
    }
    to {
      opacity: 1;
      clip-path: inset(0 0 0 0);
    }
  }

  /* 尊重使用者的減少動態偏好設定 */
  @media (prefers-reduced-motion: reduce) {
    .line-reveal {
      opacity: 1;
      animation: none;
    }
    .line-reveal::after {
      display: none;
    }
  }
</style>
