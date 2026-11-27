<script setup lang="ts">
  import { onMounted, watch } from 'vue'

  /**
   * ScrambleText：文章成果區塊共用的解碼文字（包一層 useTextScramble）。
   * - text 改變時自動重新解碼；autoplay 為 false 時先直接顯示原文，呼叫 play() 才播放
   * - 文字會先把 < > & 換成全形符號再交給 v-html（Playground 的輸入框是使用者輸入，避免被插入 HTML）
   * - duration / chars 只在建立時讀取：要換參數時由父層改 :key 重新建立
   */
  const props = withDefaults(
    defineProps<{ text: string; duration?: number; chars?: string; autoplay?: boolean }>(),
    { duration: 40, chars: undefined, autoplay: true }
  )

  const safe = (text: string) => text.replace(/[<>&]/g, (c) => ({ '<': '‹', '>': '›', '&': '＆' })[c]!)

  const { output, setText } = useTextScramble({ duration: props.duration, chars: props.chars })
  const play = (text = props.text) => setText(safe(text))

  if (!props.autoplay) output.value = safe(props.text)
  onMounted(() => props.autoplay && play())
  watch(
    () => props.text,
    (text) => play(text)
  )

  defineExpose({ play })
</script>

<template>
  <span class="scramble-text">
    <span class="sr-only">{{ text }}</span>
    <span aria-hidden="true" v-html="output"></span>
  </span>
</template>

<style scoped>
  .scramble-text :deep(.scramble-dud) {
    opacity: 0.45;
  }
</style>
