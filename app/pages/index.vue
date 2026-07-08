<template>
  <div class="w-full">
    <div class="relative w-full p-6 z-10">
      <Panel />
    </div>
    <div class="absolute left-0 top-0 w-full h-full z-0 overflow-hidden perspective-[1000px]">
      <img
        :src="mainPic"
        alt="main"
        class="w-full h-full object-cover will-change-transform"
        :style="{ transform: tiltStyle }"
      />
    </div>
  </div>
</template>

<script setup>
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'

  import mainPic from '@/assets/images/main.png'

  gsap.registerPlugin(ScrollTrigger)

  const { tiltStyle } = useTilt({ max: 1, scale: 1.06 })
</script>
