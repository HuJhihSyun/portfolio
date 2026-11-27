<script setup lang="ts">
  import { ref } from 'vue'

  /** 成果：選單 hover 時重播解碼（每個項目一個 ScrambleText，一開始直接顯示原文） */
  const ITEMS = [
    { no: '001', label: 'Home' },
    { no: '002', label: 'Articles' },
    { no: '003', label: 'Gallery' },
    { no: '004', label: 'Contact' }
  ]
  const texts = ref<({ play: () => void } | null)[]>([])
</script>

<template>
  <ul class="demo-menu">
    <li v-for="(item, i) in ITEMS" :key="item.label">
      <a
        href="#"
        class="demo-menu-link"
        data-cursor="Hover"
        @click.prevent
        @mouseenter="texts[i]?.play()"
        @focus="texts[i]?.play()"
      >
        <span class="demo-menu-no">{{ item.no }}</span>
        <ArticleDemoScrambleText
          :ref="(el) => (texts[i] = el as { play: () => void } | null)"
          :text="item.label"
          :duration="16"
          :autoplay="false"
        />
        <span class="demo-menu-arrow" aria-hidden="true">→</span>
      </a>
    </li>
  </ul>
</template>

<style scoped>
  .demo-menu {
    padding: 20px 24px;
  }

  .demo-menu li + li {
    border-top: 0.5px solid rgb(255 255 255 / 0.18);
  }

  .demo-menu-link {
    display: flex;
    align-items: baseline;
    gap: 18px;
    padding: 14px 0;
    font-size: clamp(22px, 3vw, 34px);
    font-weight: 700;
    text-transform: uppercase;
    transition: padding 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .demo-menu-no {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.08em;
    opacity: 0.5;
  }

  .demo-menu-arrow {
    margin-left: auto;
    font-size: 18px;
    opacity: 0;
    translate: -8px 0;
    transition:
      opacity 0.3s,
      translate 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .demo-menu-link:hover,
  .demo-menu-link:focus-visible {
    padding-left: 12px;
    outline: none;

    .demo-menu-arrow {
      opacity: 1;
      translate: 0 0;
    }
  }
</style>
