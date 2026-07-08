<script setup lang="ts">
  import { ref, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import characterPic from '@/assets/images/character.jpg'

  const menuList = ref<{ label: string }[]>([
    { label: 'About' },
    { label: 'Skills' },
    { label: 'Works' },
    { label: 'Contact' }
  ])

  const profileText = `Senior Front-End Engineer & Designer with 5+ years of experience specializing in the Vue ecosystem (Vue/Nuxt) and high-performance e-commerce platforms. Expert in blending design with code to build immersive, interactive web experiences using GSAP and D3.js. Proven track record in optimizing web performance (LCP/CLS) and delivering scalable architectures from concept to deployment.`

  const { output: profileOutput, setText } = useTextScramble({ duration: 40 })

  onMounted(() => {
    setText(profileText)
  })

  const mainTitle = reactive([{ text: 'Code.' }, { text: 'Design.' }, { text: 'Interact.' }])

  // step 切換狀態機：'one'（初始畫面） →（exit 動畫）→ 'two'（角色圖）
  const phase = ref<'one' | 'two'>('one')
  const exiting = ref(false) // step-1 正在播消失動畫
  let swapTimer: ReturnType<typeof setTimeout> | null = null

  // 進度越過門檻 → 播 step-1 消失動畫，動畫結束後換成 step-2
  const goStep2 = () => {
    if (phase.value !== 'one' || exiting.value) return
    exiting.value = true
    setText('') // 左上 article：Text Scramble 反向消失（往空字串亂數化）
    // 右下 article 的 Block Reveal 消失由 .is-exiting class 觸發（見 <style>）
    swapTimer = setTimeout(() => {
      phase.value = 'two' // 移除 step-1、掛載 step-2（step-2 進場動畫在 CSS）
      exiting.value = false
    }, 500)
  }

  // 往回捲動 → 還原成 step-1，並重播 Text Scramble 進場
  const goStep1 = () => {
    if (phase.value !== 'two') return
    if (swapTimer) clearTimeout(swapTimer)
    phase.value = 'one'
    exiting.value = false
    nextTick(() => setText(profileText))
  }

  // 由 index.vue 的 ScrollTrigger onUpdate 傳入捲動進度（0~1）
  const onScrollProgress = (p: number) => {
    if (p > 0.45) goStep2()
    else if (p < 0.4) goStep1()
  }

  onBeforeUnmount(() => {
    if (swapTimer) clearTimeout(swapTimer)
  })

  // 暴露給父層（index.vue）呼叫
  defineExpose({ onScrollProgress })
</script>

<template>
  <div class="panel fixed w-[calc(100vw-48px)] h-[calc(100dvh-48px)] border-[0.5px] rounded-xl overflow-hidden">
    <div class="p-line top flex justify-center items-center border-b-[0.5px]">
      <span class="panel-chip text-xs font-bold px-6 py-3 whitespace-nowrap clip-br-bevel">My Portfolio</span>
      <nav class="w-full flex justify-center items-center text-xs px-6 py-3">
        <ul class="flex justify-center items-center gap-6 lg:gap-8 text-xs">
          <li v-for="item in menuList" :key="item.label">
            {{ item.label }}
          </li>
        </ul>
      </nav>
      <span class="p-line text-xs px-6 py-3 whitespace-nowrap border-l-[0.5px] w-14">Z</span>
    </div>
    <div class="middle w-full h-[calc(100dvh-88px)] flex justify-center items-center">
      <main class="relative w-full h-full overflow-hidden">
        <div v-if="phase === 'one'" class="step-1 absolute inset-0">
          <article class="w-1/2 text-sm p-6" v-html="profileOutput"></article>
          <article
            class="absolute flex flex-col items-end right-0 bottom-0 w-1/2 text-6xl md:text-7xl lg:text-8xl text-right p-6 leading-none"
          >
            <h2
              v-for="(item, index) in mainTitle"
              :key="item.text"
              class="line-reveal"
              :class="{ 'is-exiting': exiting }"
              :style="`--i: ${index}`"
            >
              <span class="line-reveal-text"
                ><sup class="text-xs md:text-sm lg:text-base">0{{ index + 1 }}</sup
                >{{ item.text }}</span
              >
            </h2>
          </article>
        </div>
        <div v-else class="step-2 absolute inset-0 flex">
          <div class="border-r-[0.5px] p-line p-6">
            <img :src="characterPic" alt="character" class="h-full w-auto object-contain rounded-2xl" />
          </div>
        </div>
      </main>
      <div
        class="p-line h-full text-xs px-6 py-3 flex justify-center items-center whitespace-nowrap border-l-[0.5px] w-14"
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

    &-text {
      opacity: 0;
      animation: reveal-text 0.01s linear forwards; /* 依 --i 錯開每一行的時間（0.4s 對應橫條完全蓋住文字的時點） */
      animation-delay: calc(var(--i) * 0.25s + 0.4s);
    }

    &:after {
      content: '';
      position: absolute;
      inset: 0;
      transform: scaleX(0);
      transform-origin: left;
      background: var(--panel-fg, #fff);
      animation: bar-wipe 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
      animation-delay: calc(var(--i) * 0.25s);
    }

    /* 消失：橫條再次劃過，經過時文字淡出（Block Reveal 反向） */
    &.is-exiting {
      .line-reveal-text {
        opacity: 1;
        animation: reveal-text-out 0.8s linear forwards;
        animation-delay: calc(var(--i) * 0.25s);
      }

      &:after {
        animation: bar-wipe 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        animation-delay: calc(var(--i) * 0.25s);
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
