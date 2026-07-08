<script setup lang="ts">
  interface MenuItem {
    label: string
  }

  const menuList = ref<MenuItem[]>([{ label: 'About' }, { label: 'Skills' }, { label: 'Works' }, { label: 'Contact' }])

  const profileText = `Senior Front-End Engineer & Designer with 5+ years of experience specializing in the Vue ecosystem (Vue/Nuxt) and high-performance e-commerce platforms. Expert in blending design with code to build immersive, interactive web experiences using GSAP and D3.js. Proven track record in optimizing web performance (LCP/CLS) and delivering scalable architectures from concept to deployment.`

  const { output: profileOutput, setText } = useTextScramble({ duration: 40 })

  onMounted(() => {
    setText(profileText)
  })

  const mainTitle = reactive([{ text: 'Code.' }, { text: 'Design.' }, { text: 'Interact.' }])
</script>

<template>
  <div class="w-full h-[calc(100dvh-48px)] border-[0.5px] border-white/50 rounded-xl overflow-hidden">
    <div class="top flex justify-center items-center border-b-[0.5px] border-white/50">
      <span class="text-xs font-bold px-6 py-3 bg-white text-black whitespace-nowrap clip-br-bevel">My Portfolio</span>
      <nav class="w-full flex justify-center items-center text-xs px-6 py-3">
        <ul class="flex justify-center items-center gap-6 lg:gap-8 text-white text-xs">
          <li v-for="item in menuList" :key="item.label">
            {{ item.label }}
          </li>
        </ul>
      </nav>
      <span class="text-xs px-6 py-3 text-white whitespace-nowrap border-l-[0.5px] border-white/50 w-14">Z</span>
    </div>
    <div class="middle w-full h-[calc(100dvh-88px)] flex justify-center items-center">
      <main class="relative w-full h-full">
        <article class="w-1/2 text-sm text-white p-6" v-html="profileOutput"></article>
        <article
          class="absolute right-0 bottom-0 w-1/2 text-6xl md:text-7xl lg:text-8xl text-white text-right p-6 leading-none"
        >
          <h2 v-for="(item, index) in mainTitle" :key="item.text" class="line-reveal" :style="`--i: ${index}`">
            <span class="line-reveal-text"
              ><sup class="text-xs md:text-sm lg:text-base">0{{ index + 1 }}</sup
              >{{ item.text }}</span
            >
          </h2>
        </article>
      </main>
      <div
        class="h-full text-xs px-6 py-3 flex justify-center items-center text-white whitespace-nowrap border-l-[0.5px] border-white/50 w-14"
      >
        <span class="text-xs text-white font-normal [writing-mode:vertical-rl]">Side Project by Syun</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
      background: #fff;
      animation: bar-wipe 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
      animation-delay: calc(var(--i) * 0.25s);
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
