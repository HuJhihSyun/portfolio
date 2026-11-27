<script setup lang="ts">
  import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
  import type { Block } from '#shared/posts'

  /**
   * 文章內文渲染器：依 Editor.js 區塊的 type 渲染對應元素（格式見 shared/posts/types.ts）。
   * - 二級標題：上方一條細線、編號 01 / 02…，id 為錨點（目錄用）；捲入畫面時標題解碼一次
   * - 程式碼：ArticleCodeBlock；成果：深色舞台＋可操作的 demo 元件
   * 段落等內文的行內 HTML 來自自己撰寫的文章資料（可信任），以 v-html 渲染。
   */
  const props = defineProps<{ blocks: Block[] }>()

  // 二級標題的編號
  const sectionNo = computed(() => {
    const map: Record<string, string> = {}
    let n = 0
    props.blocks.forEach((block) => {
      if (block.type === 'header' && block.data.level === 2) map[block.id] = String(++n).padStart(2, '0')
    })
    return map
  })

  // 二級標題捲入畫面時解碼一次
  const h2Blocks = computed(() => props.blocks.filter((block) => block.type === 'header' && block.data.level === 2))
  const scrambles = new Map(
    h2Blocks.value.map((block) => [block.id, useTextScramble({ duration: 24 })] as const)
  )
  const played = ref(new Set<string>())
  const plainText = (html: string) => html.replace(/<[^>]*>/g, '')

  let observer: IntersectionObserver | null = null
  const root = ref<HTMLElement | null>(null)
  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const id = (entry.target as HTMLElement).dataset.block!
          const block = props.blocks.find((b) => b.id === id)
          if (block?.type === 'header') scrambles.get(id)?.setText(plainText(block.data.text))
          played.value.add(id)
          observer?.unobserve(entry.target)
        })
      },
      { threshold: 0.6 }
    )
    root.value?.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => observer!.observe(el))
  })
  onBeforeUnmount(() => observer?.disconnect())

  // demo 名稱 → 元件（resolveComponent 的字串需寫死，Nuxt 才會在編譯時轉成匯入）
  const DEMOS = {
    'text-scramble-basic': resolveComponent('ArticleDemoTextScrambleBasic'),
    'text-scramble-hover': resolveComponent('ArticleDemoTextScrambleHover'),
    'text-scramble-playground': resolveComponent('ArticleDemoTextScramblePlayground')
  }
  const TONE_LABEL = { note: 'Note', tip: 'Tip', warning: 'Warning' }
</script>

<template>
  <div ref="root" class="article-blocks">
    <template v-for="block in blocks" :key="block.id">
      <!-- 標題 -->
      <h2
        v-if="block.type === 'header' && block.data.level === 2"
        :id="block.id"
        class="b-h2"
        :data-block="block.id"
        data-scramble
      >
        <span class="b-h2-no tabular-nums" aria-hidden="true"><i></i>{{ sectionNo[block.id] }}</span>
        <span class="sr-only" v-html="block.data.text"></span>
        <span
          aria-hidden="true"
          class="b-h2-text"
          v-html="played.has(block.id) ? scrambles.get(block.id)!.output.value || '&nbsp;' : block.data.text"
        ></span>
      </h2>
      <h3 v-else-if="block.type === 'header' && block.data.level === 3" :id="block.id" class="b-h3 rich" v-html="block.data.text"></h3>
      <h4 v-else-if="block.type === 'header'" :id="block.id" class="b-h4 rich" v-html="block.data.text"></h4>

      <!-- 段落 -->
      <p v-else-if="block.type === 'paragraph'" class="b-p rich" v-html="block.data.text"></p>

      <!-- 清單 -->
      <component
        :is="block.data.style === 'ordered' ? 'ol' : 'ul'"
        v-else-if="block.type === 'list'"
        class="b-list rich"
        :class="`is-${block.data.style}`"
      >
        <li v-for="(item, i) in block.data.items" :key="i" v-html="item"></li>
      </component>

      <!-- 程式碼 -->
      <ArticleCodeBlock v-else-if="block.type === 'code'" :data="block.data" />

      <!-- 引言 -->
      <blockquote v-else-if="block.type === 'quote'" class="b-quote rich">
        <p v-html="block.data.text"></p>
        <cite v-if="block.data.caption" class="dot-caption"><i></i>{{ block.data.caption }}</cite>
      </blockquote>

      <!-- 提示框 -->
      <aside v-else-if="block.type === 'warning'" class="b-callout rich" :class="`is-${block.data.tone ?? 'note'}`">
        <p class="b-callout-head dot-caption"><i></i>{{ TONE_LABEL[block.data.tone ?? 'note'] }}</p>
        <p class="b-callout-title" v-html="block.data.title"></p>
        <p class="b-callout-text" v-html="block.data.message"></p>
      </aside>

      <!-- 表格 -->
      <div v-else-if="block.type === 'table'" class="b-table-wrap rich">
        <table class="b-table">
          <thead v-if="block.data.withHeadings">
            <tr>
              <th v-for="(cell, i) in block.data.content[0]" :key="i" v-html="cell"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in block.data.withHeadings ? block.data.content.slice(1) : block.data.content" :key="r">
              <td v-for="(cell, i) in row" :key="i" v-html="cell"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 圖片 -->
      <figure v-else-if="block.type === 'image'" class="b-figure">
        <img
          :src="block.data.file.url"
          :alt="block.data.alt ?? block.data.caption ?? ''"
          :width="block.data.file.width"
          :height="block.data.file.height"
          loading="lazy"
        />
        <figcaption v-if="block.data.caption" class="dot-caption"><i></i>{{ block.data.caption }}</figcaption>
      </figure>

      <!-- 分隔線 -->
      <hr v-else-if="block.type === 'delimiter'" class="b-hr" />

      <!-- 成果（可操作的 demo） -->
      <figure v-else-if="block.type === 'demo'" class="b-demo">
        <div class="b-demo-head">
          <span class="dot-caption"><i></i>Result · 成果</span>
          <span class="b-demo-live" aria-hidden="true">Live</span>
        </div>
        <div class="b-demo-stage">
          <component :is="DEMOS[block.data.component]" />
        </div>
        <figcaption v-if="block.data.caption" class="b-demo-caption">{{ block.data.caption }}</figcaption>
      </figure>
    </template>
  </div>
</template>

<style scoped>
  .article-blocks {
    font-size: 16px;
    line-height: 1.9;
  }

  .dot-caption {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    font-style: normal;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.6;

    i {
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  /* ── 標題：上方細線橫跨整欄（同參考頁的段落分隔） ── */
  .b-h2 {
    margin: 72px 0 20px;
    padding-top: 28px;
    border-top: 0.5px solid var(--panel-line);
    font-size: clamp(24px, 2.6vw, 34px);
    font-weight: 700;
    line-height: 1.3;
    scroll-margin-top: 24px;
  }

  .b-h2-no {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.1em;
    opacity: 0.5;

    i {
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  .b-h2-text :deep(.scramble-dud) {
    opacity: 0.4;
  }

  .b-h3 {
    margin: 40px 0 12px;
    font-size: 20px;
    font-weight: 700;
  }

  .b-h4 {
    margin: 28px 0 8px;
    font-size: 16px;
    font-weight: 700;
  }

  .b-p {
    margin: 16px 0;
  }

  /* 行內元素：只套用在文字區塊（不影響成果區塊裡 demo 自己的樣式） */
  .rich :deep(code) {
    padding: 0.1em 0.4em;
    border: 0.5px solid var(--panel-line);
    background: rgb(0 0 0 / 0.04);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.86em;
  }

  .rich :deep(b),
  .rich :deep(strong) {
    font-weight: 700;
  }

  .rich :deep(a) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .rich :deep(mark) {
    padding: 0 0.2em;
    background: rgb(0 0 0 / 0.9);
    color: #fff;
  }

  /* 清單：無序為方點（同 dot-caption 的 ■），有序為兩位數編號 */
  .b-list {
    margin: 16px 0;
    padding-left: 0;
    counter-reset: item;

    li {
      position: relative;
      padding-left: 28px;
      counter-increment: item;

      & + li {
        margin-top: 8px;
      }

      &::before {
        position: absolute;
        left: 0;
      }
    }

    &.is-unordered li::before {
      content: '';
      top: 0.8em;
      width: 5px;
      height: 5px;
      background: currentColor;
    }

    &.is-ordered li::before {
      content: counter(item, decimal-leading-zero);
      top: 0.2em;
      font-size: 11px;
      letter-spacing: 0.06em;
      opacity: 0.5;
    }
  }

  .b-quote {
    margin: 40px 0;
    padding: 4px 0 4px 24px;
    border-left: 2px solid currentColor;

    p {
      font-size: clamp(18px, 2vw, 24px);
      font-weight: 700;
      line-height: 1.5;
    }

    cite {
      display: flex;
      margin-top: 12px;
    }
  }

  /* 提示框：細框＋左上斜切 */
  .b-callout {
    margin: 28px 0;
    padding: 18px 22px;
    border: 0.5px solid var(--panel-line);
    background: rgb(0 0 0 / 0.025);
    clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px);

    &.is-warning {
      border-color: rgb(0 0 0 / 0.5);
    }
  }

  .b-callout-title {
    margin-top: 8px;
    font-weight: 700;
  }

  .b-callout-text {
    margin-top: 4px;
    font-size: 15px;
    line-height: 1.8;
    opacity: 0.85;
  }

  .b-table-wrap {
    margin: 28px 0;
    overflow-x: auto;
  }

  .b-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    line-height: 1.6;

    th,
    td {
      padding: 12px 14px 12px 0;
      border-bottom: 0.5px solid var(--panel-line);
      text-align: left;
      vertical-align: top;
    }

    th {
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.6;
    }
  }

  .b-figure {
    margin: 32px 0;

    img {
      width: 100%;
      height: auto;
    }

    figcaption {
      margin-top: 10px;
    }
  }

  .b-hr {
    margin: 56px 0;
    border: 0;
    border-top: 0.5px solid var(--panel-line);
  }

  /* ── 成果：深色舞台（同網站的深色主題），右上斜切 ── */
  .b-demo {
    margin: 32px 0;
  }

  .b-demo-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
  }

  .b-demo-live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.6;

    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      animation: live-blink 1.4s steps(1) infinite;
    }
  }

  @keyframes live-blink {
    50% {
      opacity: 0;
    }
  }

  .b-demo-stage {
    position: relative;
    background:
      linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px) 0 0 / 24px 24px,
      linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px) 0 0 / 24px 24px,
      #0b0b0b;
    color: #fff;
    clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%);

    /* 成果區塊內共用的按鈕 */
    :deep(.demo-btn) {
      padding: 8px 18px;
      border: 0.5px solid rgb(255 255 255 / 0.45);
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      transition:
        background 0.25s,
        color 0.25s;

      &.is-primary,
      &:hover,
      &:focus-visible {
        outline: none;
        background: #fff;
        color: #0b0b0b;
      }

      &.is-primary:hover {
        background: transparent;
        color: #fff;
      }
    }
  }

  .b-demo-caption {
    margin-top: 10px;
    font-size: 13px;
    opacity: 0.6;
  }

  @media (prefers-reduced-motion: reduce) {
    .b-demo-live::before {
      animation: none;
    }
  }
</style>
