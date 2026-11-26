<script setup lang="ts">
  import type { GalleryItem } from '#shared/gallery'

  /**
   * GalleryWorkCard：Gallery Works 區的單張作品卡（參考 kprverse Gallery 的格狀卡片）。
   * 封面以 TechFrame 裁出外形（角型依作品 id 固定挑選一組，同一張每次都一樣，SSR 也一致），
   * 下方為「■ 編號 標題」與細類 / 年份；整張卡連到 Behance 作品頁。
   * 進場與切換分類的動畫由父層（GalleryWorks）以 gsap 操作 .work-card / .work-media，
   * 標題的解碼效果由父層呼叫 play()。
   */

  type Corner = {
    type: 'round' | 'bevel' | 'notch' | 'square'
    size?: number | string
    depth?: number
    radius?: number
  }
  type Corners = { topLeft: Corner; topRight: Corner; bottomRight: Corner; bottomLeft: Corner }

  const props = defineProps<{
    item: GalleryItem
    index: number // 在目前清單中的序號（從 0 起）
  }>()

  // 四組外框角（同首頁 TechFrame 語彙：圓角為主，各帶一個斜切或缺角）
  const PRESETS: Corners[] = [
    {
      topLeft: { type: 'round', size: 10 },
      topRight: { type: 'bevel', size: 20 },
      bottomRight: { type: 'round', size: 10 },
      bottomLeft: { type: 'round', size: 10 }
    },
    {
      topLeft: { type: 'bevel', size: 20 },
      topRight: { type: 'round', size: 10 },
      bottomRight: { type: 'round', size: 10 },
      bottomLeft: { type: 'notch', size: '32%', depth: 10, radius: 6 }
    },
    {
      topLeft: { type: 'round', size: 10 },
      topRight: { type: 'round', size: 10 },
      bottomRight: { type: 'bevel', size: 20 },
      bottomLeft: { type: 'round', size: 10 }
    },
    {
      topLeft: { type: 'round', size: 10 },
      topRight: { type: 'notch', size: '30%', depth: 10, radius: 6 },
      bottomRight: { type: 'round', size: 10 },
      bottomLeft: { type: 'bevel', size: 18 }
    }
  ]
  const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0
  const corners = computed(() => PRESETS[hash(props.item.id) % PRESETS.length]!)

  // 「大類 · 細類」只顯示細類；年份取自發佈日期（手動加入的較早作品可能沒有日期）
  const sub = computed(() => props.item.kind.split('·').pop()!.trim())
  const year = computed(() => (props.item.date ? new Date(props.item.date).getFullYear() : ''))
  const number = computed(() => String(props.index + 1).padStart(2, '0'))

  const { output: titleOut, setText } = useTextScramble({ duration: 18 })
  titleOut.value = props.item.title
  const play = () => setText(props.item.title)

  defineExpose({ play })
</script>

<template>
  <li class="work-card">
    <a :href="item.link" target="_blank" rel="noopener noreferrer" class="work-link block">
      <div class="work-media">
        <TechFrame :stroke-width="0" v-bind="corners" class="work-frame">
          <img :src="item.image" :alt="item.title" class="work-img" loading="lazy" />
        </TechFrame>
        <span class="work-go" aria-hidden="true">↗</span>
      </div>
      <p class="work-meta">
        <span class="work-no tabular-nums" aria-hidden="true"><i></i>{{ number }}</span>
        <span class="work-title">
          <span class="sr-only">{{ item.title }}</span>
          <span aria-hidden="true" v-html="titleOut"></span>
        </span>
      </p>
      <p class="work-kind">
        {{ sub }}<template v-if="year"> · {{ year }}</template>
      </p>
    </a>
  </li>
</template>

<style scoped>
  .work-link {
    outline: none;
  }

  /* 封面：4:3（Behance 封面約 1.28:1）；底色為佔位色，圖片載入前 / 切換時看得到外形 */
  .work-media {
    position: relative;
    aspect-ratio: 4 / 3;
    transition: scale 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .work-frame {
    background: transparent;
  }

  .work-frame :deep(.tech-frame__clip) {
    background: rgb(255 255 255 / 0.06);
  }

  .work-img {
    transition: scale 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* 右下角的連結箭頭：hover 時浮現 */
  .work-go {
    position: absolute;
    right: 10px;
    bottom: 10px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #fff;
    color: #0b0b0b;
    font-size: 13px;
    opacity: 0;
    translate: 0 6px;
    transition:
      opacity 0.3s,
      translate 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* hover（同 kprverse：卡片微縮）＋圖片微放大、箭頭浮現 */
  @media (hover: hover) {
    .work-link:hover .work-media {
      scale: 0.97;
    }

    .work-link:hover .work-img {
      scale: 1.06;
    }

    .work-link:hover .work-go {
      opacity: 1;
      translate: 0 0;
    }
  }

  .work-link:focus-visible .work-media {
    outline: 1px solid currentColor;
    outline-offset: 4px;
  }

  .work-meta {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: 0.04em;
  }

  .work-no {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    height: 1.4em;
    opacity: 0.6;

    i {
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  .work-title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  :deep(.scramble-dud) {
    opacity: 0.6;
  }

  .work-kind {
    margin-top: 4px;
    padding-left: 24px;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.5;
  }
</style>
