<script setup lang="ts">
  import { ref, computed } from 'vue'

  /**
   * 成果：Playground。輸入文字、調整 duration 與字元集後按「解碼」。
   * 參數改變時以 :key 重新建立 ScrambleText（composable 的參數只在建立時讀取）
   */
  const CHARSETS = [
    { key: 'symbols', label: '符號（預設）', chars: '!<>-_\\/[]{}—=+*^?#________' },
    { key: 'binary', label: '二進位', chars: '01' },
    { key: 'fullwidth', label: '全形符號', chars: '＃＊＋－／＼＿＝？！' },
    { key: 'katakana', label: '片假名', chars: 'アイウエオカキクケコサシスセソタチツテト' }
  ]

  const input = ref('前端工程師的日常')
  const duration = ref(40)
  const charset = ref('fullwidth')
  const shown = ref(input.value)
  const text = ref<{ play: () => void } | null>(null)

  const chars = computed(() => CHARSETS.find((set) => set.key === charset.value)!.chars)
  const optionsKey = computed(() => `${duration.value}-${charset.value}`)
  // 對應的程式碼（跟著參數即時更新）
  const snippet = computed(
    () => `useTextScramble({ duration: ${duration.value}, chars: '${chars.value.replace(/\\/g, '\\\\')}' })`
  )

  const run = () => {
    const value = input.value.trim() || ' '
    if (value === shown.value) text.value?.play()
    else shown.value = value
  }
</script>

<template>
  <div class="demo-playground">
    <p class="demo-output">
      <ArticleDemoScrambleText ref="text" :key="optionsKey" :text="shown" :duration="duration" :chars="chars" />
    </p>

    <form class="demo-controls" @submit.prevent="run">
      <label class="demo-field is-wide">
        <span class="demo-field-label">文字</span>
        <input v-model="input" type="text" maxlength="40" class="demo-input" />
      </label>
      <label class="demo-field">
        <span class="demo-field-label">duration：{{ duration }}</span>
        <input v-model.number="duration" type="range" min="8" max="80" step="2" class="demo-range" />
      </label>
      <label class="demo-field">
        <span class="demo-field-label">字元集</span>
        <select v-model="charset" class="demo-input">
          <option v-for="set in CHARSETS" :key="set.key" :value="set.key">{{ set.label }}</option>
        </select>
      </label>
      <button type="submit" class="demo-btn is-primary">解碼</button>
    </form>

    <code class="demo-snippet">{{ snippet }}</code>
  </div>
</template>

<style scoped>
  .demo-playground {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 40px 24px 24px;
  }

  .demo-output {
    min-height: 1.3em;
    font-size: clamp(24px, 4vw, 42px);
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
    word-break: break-all;
  }

  .demo-controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    align-items: end;

    @media (min-width: 640px) {
      grid-template-columns: 1fr 1fr auto;

      .is-wide {
        grid-column: 1 / -1;
      }
    }
  }

  .demo-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .demo-field-label {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.6;
  }

  .demo-input {
    width: 100%;
    padding: 8px 0;
    border-bottom: 0.5px solid rgb(255 255 255 / 0.4);
    background: transparent;
    color: inherit;
    font-size: 14px;
    outline: none;

    &:focus {
      border-color: #fff;
    }

    option {
      color: #0b0b0b;
    }
  }

  .demo-range {
    width: 100%;
    accent-color: #fff;
  }

  .demo-snippet {
    display: block;
    overflow-x: auto;
    padding: 10px 12px;
    border: 0.5px dashed rgb(255 255 255 / 0.25);
    font-size: 12px;
    white-space: nowrap;
    opacity: 0.8;
  }
</style>
