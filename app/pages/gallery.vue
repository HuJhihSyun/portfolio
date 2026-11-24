<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import type { GalleryCategory, GalleryResponse } from '#shared/gallery'

  /**
   * Gallery 頁：目前只有 Instagram 貼文（Posts）。
   * 外框沿用首頁的 PanelShell，頂部選單為分類切換；Posts 內容為 GalleryPosts 的貼文輪盤。
   * Works（Behance）區塊之後會以不同的版型另外製作：API（/api/gallery/works）與資料格式已先備好，
   * 屆時在 TABS 加回 Works、並依 category 切換對應的元件即可。
   */

  useHead({ title: 'Gallery | Syun' })

  const TABS: { label: string; key: GalleryCategory }[] = [{ label: 'Posts', key: 'posts' }]
  const category = ref<GalleryCategory>('posts')

  const { data: posts } = await useFetch<GalleryResponse>('/api/gallery/posts')

  // 深色主題（同首頁第五幕）：外框與文字為白色
  const panelTheme = {
    '--panel-fg': '#fff',
    '--panel-bg': '#0b0b0b',
    '--panel-line': 'rgb(255 255 255 / 0.35)'
  }

  const shell = ref<{ setProgress: (progress: number) => void } | null>(null)
  const onProgress = (value: number) => shell.value?.setProgress(value)

  // 開場 loading 結束（直接開啟約 3 秒；站內換頁立即）後才播進場
  const entered = ref(false)
  const { onLoaded } = useGlobalLoading()
  let cancelEnter: (() => void) | null = null
  onMounted(() => {
    window.scrollTo(0, 0)
    cancelEnter = onLoaded(() => (entered.value = true))
  })
  onBeforeUnmount(() => cancelEnter?.())
</script>

<template>
  <div class="w-full">
    <!-- 頁面深色底（Panel 外框四周的留白也是深色） -->
    <div class="fixed inset-0 z-0 bg-[#0b0b0b]" aria-hidden="true"></div>
    <div class="relative z-10 w-full p-3 md:p-6" :style="panelTheme">
      <PanelShell ref="shell" :items="TABS" :active="category" @navigate="(key) => (category = key)">
        <GalleryPosts
          v-if="category === 'posts'"
          :items="posts?.items ?? []"
          :entered="entered"
          @progress="onProgress"
        />
      </PanelShell>
    </div>
  </div>
</template>
