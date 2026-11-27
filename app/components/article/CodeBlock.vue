<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { CodeBlock } from '#shared/posts'

  /**
   * 文章的程式碼區塊：上方為檔名 / 語言列＋複製按鈕，內容含行號與語法上色（app/utils/highlight.ts）。
   * 外框右上斜切（同網站的 TechFrame 語彙）。
   */
  const props = defineProps<{ data: CodeBlock['data'] }>()

  const LANG_LABEL: Record<string, string> = {
    ts: 'TypeScript',
    js: 'JavaScript',
    vue: 'Vue SFC',
    html: 'HTML',
    css: 'CSS',
    bash: 'Shell',
    json: 'JSON',
    text: 'Text'
  }

  const lines = computed(() => highlight(props.data.code, props.data.language).split('\n'))

  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.data.code)
      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => (copied.value = false), 1600)
    } catch {
      copied.value = false
    }
  }
</script>

<template>
  <figure class="code-block">
    <figcaption class="code-head">
      <span class="code-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="code-file">{{ data.filename ?? LANG_LABEL[data.language] }}</span>
      <span class="code-lang">{{ LANG_LABEL[data.language] }}</span>
      <button type="button" class="code-copy" :aria-label="copied ? '已複製' : '複製程式碼'" @click="copy">
        <AtomsHackyText :key="String(copied)" :text="copied ? 'Copied ✓' : 'Copy'" :speed="2" />
      </button>
    </figcaption>
    <pre class="code-body"><code><span v-for="(line, i) in lines" :key="i" class="code-line"><span class="code-no" aria-hidden="true">{{ i + 1 }}</span><span class="code-text" v-html="line || ' '"></span></span></code></pre>
  </figure>
</template>

<style scoped>
  .code-block {
    margin: 28px 0;
    background: #0d0f12;
    color: #e6e9ef;
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
  }

  .code-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 0.5px solid rgb(255 255 255 / 0.12);
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  .code-dots {
    display: inline-flex;
    gap: 5px;

    i {
      width: 7px;
      height: 7px;
      border: 0.5px solid rgb(255 255 255 / 0.5);
      border-radius: 50%;
    }
  }

  .code-file {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.85;
  }

  .code-lang {
    margin-left: auto;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.45;
  }

  .code-copy {
    margin-right: 10px;
    padding: 3px 10px;
    border: 0.5px solid rgb(255 255 255 / 0.3);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background 0.25s,
      color 0.25s;

    &:hover,
    &:focus-visible {
      outline: none;
      background: #fff;
      color: #0d0f12;
    }
  }

  .code-body {
    overflow-x: auto;
    padding: 16px 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.75;
    tab-size: 2;
  }

  .code-line {
    display: flex;
    padding-right: 20px;
  }

  .code-no {
    flex-shrink: 0;
    width: 3.2em;
    padding-right: 1.2em;
    text-align: right;
    opacity: 0.28;
    user-select: none;
  }

  .code-text {
    white-space: pre;
  }

  /* 語法上色 */
  .code-text :deep(.tk-comment) {
    color: #6b7380;
    font-style: italic;
  }

  .code-text :deep(.tk-string) {
    color: #a8d48f;
  }

  .code-text :deep(.tk-keyword) {
    color: #8fb0ff;
  }

  .code-text :deep(.tk-fn) {
    color: #f0c674;
  }

  .code-text :deep(.tk-number) {
    color: #e8a87c;
  }

  .code-text :deep(.tk-tag) {
    color: #f28fad;
  }
</style>
