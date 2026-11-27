<script setup lang="ts">
  import { ref } from 'vue'

  /** 成果：基本解碼。按「下一句」切換文字、「重播」再解碼一次 */
  const PHRASES = ['Hello, Syun.', 'Code · Motion · Design', '解碼文字效果', 'Moments between the beats.']
  const index = ref(0)
  const text = ref<{ play: () => void } | null>(null)

  const next = () => (index.value = (index.value + 1) % PHRASES.length)
  const replay = () => text.value?.play()
</script>

<template>
  <div class="demo-basic">
    <p class="demo-word">
      <ArticleDemoScrambleText ref="text" :text="PHRASES[index]!" :duration="34" />
    </p>
    <div class="demo-actions">
      <button type="button" class="demo-btn" @click="replay">重播</button>
      <button type="button" class="demo-btn is-primary" @click="next">下一句 →</button>
    </div>
  </div>
</template>

<style scoped>
  .demo-basic {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 48px 20px 28px;
  }

  .demo-word {
    min-height: 1.2em;
    font-size: clamp(26px, 4.4vw, 48px);
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
  }

  .demo-actions {
    display: flex;
    gap: 10px;
  }
</style>
