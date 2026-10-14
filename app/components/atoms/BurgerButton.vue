<script setup lang="ts">
  defineProps<{ expanded?: boolean }>()
</script>

<template>
  <!-- From Uiverse.io by Shubh0408（改為 button，hover 效果改用 group） -->
  <button
    type="button"
    class="group flex flex-col gap-1.25 w-5 md:w-8 box-content cursor-pointer"
    aria-label="開啟選單"
    aria-haspopup="dialog"
    :aria-expanded="expanded"
  >
    <span
      class="rounded-2xl h-px w-1/2 bg-current transition-[margin-left] duration-300 ml-0 group-hover:ml-[50%]"
    ></span>
    <span class="rounded-2xl h-px w-full bg-current transition-[margin-left] duration-300"></span>
    <span
      class="rounded-2xl h-px w-1/2 bg-current transition-[margin-left] duration-300 ml-[50%] group-hover:ml-0"
    ></span>
  </button>
</template>
