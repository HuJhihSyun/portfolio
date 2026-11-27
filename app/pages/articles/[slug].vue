<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
  import { SITE, displayName } from '#shared/site'
  import { ARTICLE_CHAPTERS } from '#shared/articles'
  import { getPost, postOutline, readingMinutes, formatDate } from '#shared/posts'

  /**
   * 文章內頁：版面參考 kprverse 的 Privacy Policy 頁 —— 白底、左側一欄放文章資訊、中間為內文欄，大段落以細線分隔。
   *   左欄（固定，不隨內文捲動）：麵包屑、發佈日期 / 閱讀時間、標籤、目錄（依捲動位置標示目前章節，點擊可跳轉）
   *   內文（Panel 內隨頁面捲動）：大標（進場時解碼）、摘要、Editor.js 區塊（ArticleBlocks）、文末資訊
   * 文章資料來自 shared/posts/（目前沒有後台，以程式檔維護）。
   */

  const route = useRoute()
  const post = getPost(String(route.params.slug))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Article not found', fatal: true })

  const outline = postOutline(post)
  const minutes = readingMinutes(post)
  const category = ARTICLE_CHAPTERS.find((chapter) => chapter.key === post.category)

  // ── SEO：標題 / 描述 / 分享卡片 / canonical＋文章結構化資料（BlogPosting） ──
  const base = useSiteUrl()
  const url = `${base}/articles/${post.slug}`
  const image = `${base}${post.cover?.src ?? SITE.ogImage}`
  const title = `${post.title}｜${displayName()}`
  useSeoMeta({
    title,
    description: post.excerpt,
    ogType: 'article',
    ogSiteName: SITE.siteName,
    ogLocale: SITE.locale,
    ogUrl: url,
    ogTitle: post.title,
    ogDescription: post.excerpt,
    ogImage: image,
    articlePublishedTime: post.publishedAt,
    articleModifiedTime: post.updatedAt ?? post.publishedAt,
    articleAuthor: [post.author.name],
    articleTag: post.tags,
    twitterCard: 'summary_large_image',
    twitterTitle: post.title,
    twitterDescription: post.excerpt,
    twitterImage: image
  })
  useHead({
    link: [{ rel: 'canonical', href: url }],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          author: { '@type': 'Person', name: post.author.name, url: `${base}/` },
          mainEntityOfPage: url,
          image,
          inLanguage: 'zh-TW',
          keywords: post.tags.join(', ')
        })
      }
    ]
  })

  // 白底主題（同參考頁）：黑字、淡灰分隔線
  const panelTheme = {
    '--panel-fg': '#0b0b0b',
    '--panel-bg': '#ffffff',
    '--panel-line': 'rgb(0 0 0 / 0.14)'
  }
  const TABS: { label: string; key: 'index' }[] = [{ label: '← All articles', key: 'index' }]

  const { output: titleOut, setText: setTitle } = useTextScramble({ duration: 30 })

  const root = ref<HTMLElement | null>(null)
  const spacer = ref<HTMLElement | null>(null)
  const viewport = ref<HTMLElement | null>(null)
  const flow = ref<HTMLElement | null>(null)
  const shell = ref<{ setProgress: (progress: number) => void } | null>(null)

  // ── 目錄：依捲動位置標示目前章節 ──
  const activeId = ref('')
  const headingTop = (id: string) => flow.value?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.offsetTop ?? 0
  const updateActive = () => {
    const line = scroller.currentOffset() + (viewport.value?.clientHeight ?? 0) * 0.3
    let current = ''
    outline.forEach((item) => {
      if (headingTop(item.id) <= line) current = item.id
    })
    activeId.value = current
  }

  const scroller = usePanelScroll({
    root,
    spacer,
    viewport,
    flow,
    onUpdate: (progress) => {
      shell.value?.setProgress(progress)
      updateActive()
    }
  })

  const goToHeading = (id: string) => scroller.scrollToOffset(headingTop(id) - 24)
  const backToTop = () => scroller.scrollToOffset(0)
  const onNav = () => navigateTo('/articles')

  const published = computed(() => formatDate(post.publishedAt))
  const updated = computed(() => (post.updatedAt ? formatDate(post.updatedAt) : ''))

  // 開場 loading 結束（直接開啟約 3 秒；站內換頁時等轉場退去）後：大標解碼、建立捲動
  const { onLoaded } = useGlobalLoading()
  let cancelEnter: (() => void) | null = null
  onMounted(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    scroller.measure()
    cancelEnter = onLoaded(() => {
      setTitle(post.title)
      scroller.build()
    })
  })
  onBeforeUnmount(() => {
    cancelEnter?.()
    scroller.destroy()
  })
</script>

<template>
  <div ref="root" class="w-full">
    <!-- 頁面白底 -->
    <div class="fixed inset-0 z-0 bg-[#f4f4f2]" aria-hidden="true"></div>

    <div class="relative z-10 w-full p-3 md:p-6" :style="panelTheme">
      <PanelShell ref="shell" :items="TABS" @navigate="onNav">
        <div class="article-layout relative flex h-full min-w-0 flex-1">
          <!-- 左欄：文章資訊與目錄（固定不捲動） -->
          <aside class="a-aside p-line hidden flex-col md:flex md:border-r-[0.5px]">
            <NuxtLink to="/articles" class="a-crumb dot-caption"
              ><i></i>Articles / {{ category?.label ?? post.category }}</NuxtLink
            >
            <dl class="a-meta">
              <div>
                <dt>Published</dt>
                <dd class="tabular-nums">{{ published }}</dd>
              </div>
              <div v-if="updated">
                <dt>Updated</dt>
                <dd class="tabular-nums">{{ updated }}</dd>
              </div>
              <div>
                <dt>Reading</dt>
                <dd>{{ minutes }} min</dd>
              </div>
            </dl>
            <ul class="a-tags">
              <li v-for="tag in post.tags" :key="tag">{{ tag }}</li>
            </ul>

            <nav class="a-toc" aria-label="文章目錄">
              <p class="dot-caption"><i></i>Contents</p>
              <ol>
                <li v-for="(item, i) in outline" :key="item.id">
                  <button
                    type="button"
                    class="a-toc-link"
                    :class="{ 'is-active': item.id === activeId }"
                    @click="goToHeading(item.id)"
                  >
                    <span class="tabular-nums">{{ String(i + 1).padStart(2, '0') }}</span>{{ item.text }}
                  </button>
                </li>
              </ol>
            </nav>

            <NuxtLink to="/articles" class="a-back link-hover"><span>← All articles</span></NuxtLink>
          </aside>

          <!-- 內文 -->
          <main ref="viewport" class="relative h-full min-w-0 flex-1 overflow-hidden">
            <article ref="flow" class="a-flow">
              <div class="a-inner">
                <header class="a-head">
                  <NuxtLink to="/articles" class="a-crumb dot-caption is-mobile-only"
                    ><i></i>Articles / {{ category?.label ?? post.category }}</NuxtLink
                  >
                  <h1 class="a-title">
                    <span class="sr-only">{{ post.title }}</span>
                    <span aria-hidden="true" v-html="titleOut || '&nbsp;'"></span>
                  </h1>
                  <p class="a-excerpt">{{ post.excerpt }}</p>
                  <p class="a-meta-inline dot-caption is-mobile-only">
                    <i></i>{{ published }} · {{ minutes }} min read
                  </p>
                </header>

                <ArticleBlocks :blocks="post.content.blocks" />

                <footer class="a-foot">
                  <p class="dot-caption"><i></i>Tags</p>
                  <ul class="a-tags">
                    <li v-for="tag in post.tags" :key="tag">{{ tag }}</li>
                  </ul>
                  <div class="a-foot-nav">
                    <NuxtLink to="/articles" class="link-hover"><span>← All articles</span></NuxtLink>
                    <button type="button" class="link-hover" @click="backToTop"><span>Back to top ↑</span></button>
                  </div>
                  <p class="a-foot-note">更多程式教學撰寫中，敬請期待。</p>
                </footer>
              </div>
            </article>
          </main>
        </div>
      </PanelShell>
    </div>

    <!-- 製造捲動距離（依內文高度改寫） -->
    <section ref="spacer" class="pointer-events-none relative z-10 h-[200vh]"></section>
  </div>
</template>

<style lang="scss" scoped>
  .article-layout {
    color: #0b0b0b;
  }

  .p-line {
    border-color: var(--panel-line);
  }

  .dot-caption {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.65;

    i {
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  /* 只在行動版顯示（桌機版這些資訊在左欄）；不用 md:hidden，因為 .dot-caption 的 display 會蓋過它 */
  .is-mobile-only {
    @media (min-width: 768px) {
      display: none;
    }
  }

  /* ── 左欄 ── */
  .a-aside {
    width: clamp(220px, 20vw, 300px);
    flex-shrink: 0;
    padding: 28px 24px 24px;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .a-crumb {
    transition: opacity 0.3s;

    &:hover {
      opacity: 1;
    }
  }

  .a-meta {
    display: grid;
    gap: 12px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 0.5px solid var(--panel-line);

    dt {
      font-size: 9px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.5;
    }

    dd {
      margin-top: 2px;
      font-size: 12px;
      letter-spacing: 0.04em;
    }
  }

  .a-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 18px;

    li {
      padding: 3px 9px;
      border: 0.5px solid var(--panel-line);
      border-radius: 999px;
      font-size: 10px;
      letter-spacing: 0.04em;
    }
  }

  .a-toc {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 0.5px solid var(--panel-line);

    ol {
      margin-top: 12px;
    }
  }

  .a-toc-link {
    position: relative;
    display: flex;
    gap: 10px;
    width: 100%;
    padding: 6px 0 6px 12px;
    font-size: 12px;
    line-height: 1.5;
    text-align: left;
    opacity: 0.5;
    cursor: pointer;
    transition: opacity 0.3s;

    span {
      flex-shrink: 0;
      font-size: 10px;
      line-height: 1.8;
      opacity: 0.7;
    }

    /* 目前章節：左側一條實線 */
    &::before {
      content: '';
      position: absolute;
      top: 8px;
      bottom: 8px;
      left: 0;
      width: 2px;
      background: currentColor;
      transform: scaleY(0);
      transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    }

    &:hover {
      opacity: 0.85;
    }

    &.is-active {
      font-weight: 700;
      opacity: 1;

      &::before {
        transform: scaleY(1);
      }
    }
  }

  .a-back {
    align-self: flex-start;
    margin-top: auto;
    padding-top: 24px;
  }

  /* ── 內文 ── */
  .a-flow {
    position: relative;
    will-change: transform;
  }

  .a-inner {
    max-width: 820px;
    padding: 28px 18px 96px;

    @media (min-width: 768px) {
      padding: 48px 64px 140px;
    }
  }

  .a-head {
    padding-bottom: 36px;
    border-bottom: 0.5px solid var(--panel-line);
  }

  .a-title {
    min-height: 1.15em;
    margin-top: 12px;
    font-size: clamp(32px, 4.4vw, 64px);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.01em;

    :deep(.scramble-dud) {
      opacity: 0.35;
    }
  }

  .a-excerpt {
    max-width: 40rem;
    margin-top: 24px;
    font-size: 16px;
    line-height: 1.8;
    opacity: 0.7;
  }

  .a-meta-inline {
    margin-top: 16px;
  }

  .a-foot {
    margin-top: 80px;
    padding-top: 28px;
    border-top: 0.5px solid var(--panel-line);
  }

  .a-foot-nav {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 40px;
  }

  .a-foot-note {
    margin-top: 24px;
    font-size: 13px;
    opacity: 0.55;
  }

  /* 文字連結：hover 時黑底由左往右刷入、文字反白 */
  .link-hover {
    position: relative;
    margin-left: -4px;
    padding: 2px 4px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--panel-fg, #000);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s cubic-bezier(0.7, 0, 0.3, 1);
    }

    > span {
      position: relative;
    }

    &:hover,
    &:focus-visible {
      outline: none;
      color: var(--panel-bg, #fff);

      &::before {
        transform: scaleX(1);
      }
    }
  }
</style>
