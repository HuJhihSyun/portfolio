<script setup lang="ts">
  import { useGlobalLoading } from '@/composables/useGlobalLoading'
  const { start: globalLoadingStart, finish: globalLoadingFinish } = useGlobalLoading()

  globalLoadingStart()
</script>

<template>
  <div>
    <AppLoading />
    <slot />
    <!-- 站內換頁轉場（方塊蓋滿畫面 → 換頁 → 退去），由 plugins/page-transition.client.ts 控制 -->
    <PageTransition />
  </div>
</template>
