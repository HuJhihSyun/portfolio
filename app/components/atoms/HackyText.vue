<script setup lang="ts">
  import { ref, onBeforeUnmount } from 'vue'

  /**
   * Hacky Text（逐字解碼）：字元由左至右一個個長出（先以亂碼呈現），再由左至右依序確定成原文。
   * 與 useTextScramble（每個字元隨機時間點解碼）不同，這裡是有方向性的「打字機式」解碼，
   * 用於側選單項目的進場與 hover。
   */
  const props = withDefaults(
    defineProps<{
      text: string
      hidden?: boolean // 初始是否隱藏（等呼叫 play() 才顯示）
    }>(),
    { hidden: false }
  )

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const APPEAR_STEP = 30 // 每個字元長出的間隔（ms）
  const RESOLVE_DELAY = 150 // 第一個字元開始確定前的延遲（ms）
  const RESOLVE_STEP = 60 // 每個字元確定的間隔（ms）
  const NOISE_REFRESH = 40 // 亂碼跳動的頻率（ms），避免每影格都換字造成過度閃爍

  const output = ref(props.hidden ? '' : props.text)

  let frameId = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

  const stop = () => {
    cancelAnimationFrame(frameId)
    clearTimeout(timer)
  }

  /** 播放解碼動畫，delay 為延遲開始的毫秒數 */
  const play = (delay = 0) => {
    stop()
    const text = props.text

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      output.value = text
      return
    }

    output.value = ''
    timer = setTimeout(() => {
      const start = performance.now()
      let lastNoise = 0
      let noise: string[] = []

      const tick = (now: number) => {
        const t = now - start
        const shown = Math.min(text.length, Math.floor(t / APPEAR_STEP) + 1) // 已長出的字數
        const resolved = Math.min(text.length, Math.max(0, Math.floor((t - RESOLVE_DELAY) / RESOLVE_STEP) + 1)) // 已確定的字數

        if (now - lastNoise > NOISE_REFRESH) {
          noise = Array.from(text, randomChar)
          lastNoise = now
        }

        let str = text.slice(0, resolved)
        for (let i = resolved; i < shown; i++) {
          // 空白與換行保持原樣，不參與亂碼
          str += /\s/.test(text[i]!) ? text[i] : noise[i]
        }
        output.value = str

        if (resolved < text.length) frameId = requestAnimationFrame(tick)
      }
      frameId = requestAnimationFrame(tick)
    }, delay)
  }

  /** 立即清空文字（停止進行中的動畫） */
  const hide = () => {
    stop()
    output.value = ''
  }

  onBeforeUnmount(stop)

  defineExpose({ play, hide })
</script>

<template>
  <!-- spacer 以原文撐出固定尺寸（避免解碼中寬度跳動，也保留給螢幕閱讀器），動畫層疊在上方 -->
  <span class="relative inline-block">
    <span class="opacity-0">{{ text }}</span>
    <span class="absolute inset-0" aria-hidden="true">{{ output }}</span>
  </span>
</template>
