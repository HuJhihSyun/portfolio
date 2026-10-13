<script setup lang="ts">
  import { ref, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import type gsap from 'gsap'
  import characterPic from '@/assets/images/character.jpg'

  const menuList = ref<{ label: string }[]>([
    { label: 'About' },
    { label: 'Skills' },
    { label: 'Works' },
    { label: 'Contact' }
  ])

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
  const revealOut = () => (exiting.value = true) // 下捲：播退場動畫
  const revealIn = () => (exiting.value = false) // 回捲：移除 class，還原成進場後的可見狀態

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
    addTo: (tl: gsap.core.Timeline, at: number) => void
    enter: () => void
    leave: () => void
  } | null>(null)

  // 暴露給父層（index.vue）呼叫
  defineExpose({ enter, scrambleOut, scrambleIn, revealOut, revealIn, aboutIn, aboutOut, skills })
</script>

<template>
  <!-- 行動版（< md）外框內距縮為 12px、圓角縮小；中段改以 flex-1 填滿頂列以外的高度 -->
  <div
    class="panel fixed flex flex-col w-[calc(100vw-24px)] h-[calc(100dvh-24px)] md:w-[calc(100vw-48px)] md:h-[calc(100dvh-48px)] border-[0.5px] rounded-lg md:rounded-xl overflow-hidden"
  >
    <div class="p-line top flex justify-between md:justify-center items-center border-b-[0.5px]">
      <span class="panel-chip text-xs font-bold pl-4 pr-5 md:pl-6 md:pr-7 py-3 whitespace-nowrap clip-br-bevel"
        >My Portfolio</span
      >
      <!-- 行動版寬度不足以放下選單，先隱藏（待選單有實際連結後再改為漢堡選單） -->
      <nav class="hidden md:flex w-full justify-center items-center text-xs px-6 py-3">
        <ul class="flex justify-center items-center gap-6 lg:gap-8 text-xs">
          <li v-for="item in menuList" :key="item.label">
            {{ item.label }}
          </li>
        </ul>
      </nav>
      <span class="p-line text-xs text-center py-3 whitespace-nowrap border-l-[0.5px] w-10 md:w-14">Z</span>
    </div>
    <div class="middle w-full flex-1 min-h-0 flex justify-center items-center">
      <main class="relative w-full h-full overflow-hidden">
        <!-- 第一幕：行動版文字與標題改為滿寬，上下分置避免重疊 -->
        <article
          ref="headerText"
          class="w-full md:w-1/2 leading-relaxed text-sm md:leading-normal p-4 md:p-6"
          v-html="profileOutput"
        ></article>
        <article
          class="absolute flex flex-col items-end right-0 bottom-0 w-full md:w-1/2 text-5xl md:text-7xl lg:text-8xl [@media(max-height:500px)]:text-5xl text-right p-4 md:p-6 leading-none"
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
          class="absolute left-0 bottom-0 w-1/2 h-[58%] max-md:[@media(max-height:640px)]:h-[45%] border-t-[0.5px] border-r-[0.5px] p-line p-4 md:top-0 md:w-1/3 md:h-full md:border-t-0 md:p-6"
        >
          <!-- perspective 容器 + 卡片層：卡片以右緣為軸做 3D 翻開（由 index.vue 的 ScrollTrigger 驅動） -->
          <div class="w-full h-full perspective-distant">
            <div ref="characterCard" class="w-full h-full">
              <TechFrame
                :strokeWidth="0"
                :bottom-left="{ type: 'notch', size: '50%', depth: '24px', radius: '12px', orientation: 'vertical' }"
                class="w-full h-full"
              >
                <img
                  :src="characterPic"
                  alt="character"
                  class="will-change-transform"
                  :style="{ transform: characterTilt }"
                />
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
          class="invisible absolute pointer-events-none right-4 bottom-4 w-[calc(50%-32px)] aspect-3/4 md:right-auto md:left-[calc(100%/3+24px)] md:bottom-6 md:w-[350px] md:h-[200px] md:aspect-auto"
        ></div>
        <SkillsBoard ref="skills" />
      </main>
      <div
        class="p-line h-full text-xs md:px-6 py-3 flex justify-center items-center whitespace-nowrap border-l-[0.5px] w-10 md:w-14"
      >
        <span class="text-xs font-normal [writing-mode:vertical-rl]">Side Project by Syun</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  /* 主題配色以 CSS 變數驅動，由 index.vue 的 ScrollTrigger 補間白 → 黑。
     fallback 為白色主題，讓 Panel 單獨使用時也正常。 */
  .panel {
    color: var(--panel-fg, #fff); /* 文字色（子層繼承） */
    border-color: var(--panel-line, rgb(255 255 255 / 0.5)); /* 外框線 */
  }

  /* 內部各分隔線 */
  .p-line {
    border-color: var(--panel-line, rgb(255 255 255 / 0.5));
  }

  /* 反白的 My Portfolio 標籤：底色 = 前景色、文字 = 背景色 */
  .panel-chip {
    background: var(--panel-fg, #fff);
    color: var(--panel-bg, #000);
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
