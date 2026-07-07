<script setup lang="ts">
  interface MenuItem {
    label: string
  }

  const menuList = ref<MenuItem[]>([{ label: 'About' }, { label: 'Skills' }, { label: 'Works' }, { label: 'Contact' }])
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
        <article class="w-1/2 text-sm text-white p-6">
          Senior Front-End Engineer & Designer with 5+ years of experience specializing in the Vue ecosystem (Vue/Nuxt)
          and high-performance e-commerce platforms. Expert in blending design with code to build immersive, interactive
          web experiences using GSAP and D3.js. Proven track record in optimizing web performance (LCP/CLS) and
          delivering scalable architectures from concept to deployment.
        </article>
        <article
          class="absolute right-0 bottom-0 w-1/2 text-6xl md:text-7xl lg:text-8xl text-white text-right p-6 leading-none"
        >
          <h2><sup class="text-xs md:text-sm lg:text-base">01</sup>Code.</h2>
          <h2><sup class="text-xs md:text-sm lg:text-base">02</sup>Design.</h2>
          <h2><sup class="text-xs md:text-sm lg:text-base">03</sup>Interact.</h2>
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
