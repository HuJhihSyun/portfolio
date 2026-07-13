<script setup lang="ts">
  import { useGlobalLoading } from '@/composables/useGlobalLoading'
  const { start: globalLoadingStart, finish: globalLoadingFinish } = useGlobalLoading()

  globalLoadingStart()
</script>

<template>
  <div>
    <AppLoading />
    <slot />
  </div>
</template>
