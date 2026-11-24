<script setup lang="ts" generic="K extends string">
  import { ref } from 'vue'

  /**
   * PanelShell：各頁共用的 Panel 外框。
   * 包含：外框線、頂列（My Portfolio 標籤 / 頁內選單 / 漢堡鈕）、右側直欄（SIDE PROJECT BY SYUN + 頁面進度）、側選單。
   * 中段內容由各頁以預設 slot 放入（首頁為五幕內容，Gallery 為作品輪播）。
   * 配色由外層的 CSS 變數 --panel-fg / --panel-bg / --panel-line 決定，各頁自行設定。
   *
   * props.items：頁內選單；點擊時 emit('navigate', key)，由各頁決定行為（首頁捲到區塊、Gallery 切換分類）
   * props.active：目前選取的項目（顯示底線），首頁不需要
   */
  const props = defineProps<{ items: { label: string; key: K }[]; active?: K }>()
  const emit = defineEmits<{ navigate: [key: K] }>()

  // 側選單開關（漢堡按鈕開啟，SideMenu 內的關閉鈕 / 遮罩 / Esc 關閉）
  const menuOpen = ref(false)

  // 右側直欄的頁面進度條（參考 kprverse 外框的半透明進度填色）：由各頁呼叫 setProgress(0~1)。
  // 直接寫 CSS 變數與文字（不經 Vue 響應式），每幀更新也不會觸發重新渲染
  const progressCol = ref<HTMLElement | null>(null)
  const progressText = ref<HTMLElement | null>(null)
  let lastPercent = -1
  const setProgress = (progress: number) => {
    const p = Math.min(1, Math.max(0, progress))
    progressCol.value?.style.setProperty('--scroll-progress', String(p))
    const percent = Math.round(p * 100)
    if (percent !== lastPercent && progressText.value) {
      lastPercent = percent
      progressText.value.textContent = `${String(percent).padStart(3, '0')}%`
    }
  }

  defineExpose({ setProgress })
</script>

<template>
  <!-- 行動版（< md）外框內距縮為 12px、圓角縮小；中段改以 flex-1 填滿頂列以外的高度 -->
  <div
    class="panel fixed flex flex-col w-[calc(100vw-24px)] h-[calc(100dvh-24px)] md:w-[calc(100vw-48px)] md:h-[calc(100dvh-48px)] border-[0.5px] rounded-lg md:rounded-xl overflow-hidden"
  >
    <div class="p-line top flex justify-between md:justify-center items-center border-b-[0.5px]">
      <NuxtLink
        to="/"
        class="panel-chip text-xs font-bold pl-4 pr-5 md:pl-6 md:pr-7 py-3 whitespace-nowrap clip-br-bevel"
        >My Portfolio</NuxtLink
      >
      <!-- 行動版寬度不足以放下選單，先隱藏（各頁可在內容區另外提供行動版的切換方式） -->
      <nav class="hidden md:flex w-full justify-center items-center text-xs px-6 py-3">
        <ul class="flex justify-center items-center gap-6 lg:gap-8 text-xs">
          <li v-for="item in props.items" :key="item.key">
            <button
              type="button"
              class="nav-link"
              :class="{ 'is-active': item.key === props.active }"
              :aria-current="item.key === props.active ? 'page' : undefined"
              @click="emit('navigate', item.key)"
            >
              {{ item.label }}
            </button>
          </li>
        </ul>
      </nav>
      <span class="p-line flex self-stretch border-l-[0.5px]">
        <AtomsBurgerButton class="px-3 py-3.25" :expanded="menuOpen" @click="menuOpen = true" />
      </span>
    </div>
    <div class="middle w-full flex-1 min-h-0 flex justify-center items-center">
      <slot />
      <div
        ref="progressCol"
        class="p-line relative h-full text-xs px-3 py-3 flex flex-col items-center whitespace-nowrap border-l-[0.5px]"
      >
        <!-- 頁面進度：半透明填色由上往下推進，下緣一條細線標示目前位置（顏色隨 Panel 主題色） -->
        <span class="progress-fill" aria-hidden="true"></span>
        <span class="progress-edge" aria-hidden="true"></span>
        <div class="relative flex flex-1 items-center justify-center">
          <span class="text-[11px] leading-5 md:leading-8 md:text-xs font-normal [writing-mode:vertical-rl] uppercase"
            >Side Project by Syun</span
          >
        </div>
        <!-- 底部補上與頂部選單列等高的空白：上下扣除的高度相同，文字便置中於整個 Panel 高度，
             與側選單窄欄（滿高、文字置中）的同一行字對齊 -->
        <!-- 此空白同時放進度百分比：百分比絕對定位置中，不撐開直欄寬度（行動版直書字只有 20px 寬，
             百分比約 32px，若參與排版會把直欄撐得比頂部漢堡格寬，兩格就對不齊） -->
        <span class="relative h-[41px] w-full shrink-0" aria-hidden="true">
          <span
            ref="progressText"
            class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] tracking-wider tabular-nums opacity-70"
            >000%</span
          >
        </span>
      </div>
    </div>
    <SideMenu v-model:open="menuOpen" />
  </div>
</template>

<style lang="scss" scoped>
  /* 主題配色以 CSS 變數驅動（首頁由 ScrollTrigger 補間白 → 黑）。
     fallback 為白色主題，讓 Panel 單獨使用時也正常。 */
  .panel {
    color: var(--panel-fg, #fff); /* 文字色（子層繼承） */
    border-color: var(--panel-line, rgb(255 255 255 / 0.5)); /* 外框線 */
  }

  /* 內部各分隔線 */
  .p-line {
    border-color: var(--panel-line, rgb(255 255 255 / 0.5));
  }

  /* 頂部選單：hover / 目前項目時底線由左往右畫出 */
  .nav-link {
    position: relative;
    cursor: pointer;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -3px;
      height: 1px;
      background: currentColor;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s cubic-bezier(0.7, 0, 0.3, 1);
    }

    &:hover::after,
    &:focus-visible::after,
    &.is-active::after {
      transform: scaleX(1);
    }

    &:focus-visible {
      outline: none;
    }
  }

  /* 反白的 My Portfolio 標籤：底色 = 前景色、文字 = 背景色 */
  .panel-chip {
    background: var(--panel-fg, #fff);
    color: var(--panel-bg, #000);
  }

  /* 右側直欄的頁面進度：填色以 scaleY 縮放（只動 transform，每幀更新不重新排版） */
  .progress-fill {
    position: absolute;
    inset: 0;
    background: var(--panel-fg, #fff);
    opacity: 0.03;
    transform: scaleY(var(--scroll-progress, 0));
    transform-origin: top;
    pointer-events: none;
  }

  /* 填色下緣的細線：整層高度同直欄，以 translateY（百分比 = 自身高度）移到進度位置 */
  .progress-edge {
    position: absolute;
    inset: 0;
    border-top: 1px solid var(--panel-fg, #fff);
    opacity: 0.2;
    transform: translateY(calc(var(--scroll-progress, 0) * 100% - 1px));
    pointer-events: none;
  }
</style>
