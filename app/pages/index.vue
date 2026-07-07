<template>
  <div class="w-full">
    <div class="relative w-full p-6 z-10">
      <Panel />
    </div>
    <img :src="mainPic" alt="main" class="absolute left-0 top-0 w-full h-full object-cover z-0" />
  </div>
</template>

<script setup>
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'

  import mainPic from '@/assets/images/main.png'

  gsap.registerPlugin(ScrollTrigger)
</script>
