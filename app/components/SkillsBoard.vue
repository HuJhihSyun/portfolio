<script setup lang="ts">
  import { ref } from 'vue'
  import gsap from 'gsap'

  /**
   * SkillsBoard：第三幕（滿版背景上）的前端技能矩陣 + 經歷時間軸。
   * 由 Panel 掛載、index.vue 的主 timeline 透過 addTo() 把本元件的捲動補間接進去，
   * 進退場的標題亂碼則由 enter() / leave() 觸發。
   */

  // TODO: 依實際技能調整（level 為 0~100，決定進度條長度）
  const skillGroups = [
    {
      title: 'Core',
      items: [
        { name: 'HTML / CSS / SCSS', level: 95 },
        { name: 'JavaScript', level: 90 },
        { name: 'TypeScript', level: 80 }
      ]
    },
    {
      title: 'Framework',
      items: [
        { name: 'Vue 3', level: 92 },
        { name: 'Nuxt', level: 88 },
        { name: 'Tailwind CSS', level: 85 }
      ]
    },
    {
      title: 'Motion & Visual',
      items: [
        { name: 'GSAP', level: 90 },
        { name: 'D3.js', level: 75 },
        { name: 'Three.js', level: 60 }
      ]
    },
    {
      title: 'Performance & Tooling',
      items: [
        { name: 'Web Vitals', level: 85 },
        { name: 'Vite', level: 80 },
        { name: 'Git / CI', level: 78 }
      ]
    }
  ]

  // 職涯經歷（由舊到新，與時間軸直線由上往下畫出的方向一致）；current 標記目前任職。
  // url 為公司官網（有才渲染成連結）；logo 為公司小 icon，未提供時以公司名首字母代替
  interface Step {
    period: string
    role: string
    company: string
    url?: string
    logo?: string
    desc: string
    tags: string[]
    current?: boolean
  }
  const timeline: Step[] = [
    {
      period: '2017.09 — 2018.08',
      role: 'Web Design Assistant',
      company: 'Hongjie Information', // 已解散，無官網 → 不加連結
      desc: 'Produced visual assets and page content while learning the end-to-end web workflow, IA planning and SEO fundamentals.',
      tags: ['Visual Design', 'SEO', 'IA']
    },
    {
      period: '2018.09 — 2022.07',
      role: 'Front-End Engineer & Web Designer',
      company: 'AccessUs Integrated Marketing',
      url: 'https://www.accessus.biz/zh',
      desc: 'Designed and built interactive campaign sites on tight deadlines, turning marketing concepts into motion-driven brand stories across devices.',
      tags: ['Campaign Sites', 'Motion', 'Cross-device']
    },
    {
      period: '2022.12 — 2025.01',
      role: 'Front-End Engineer',
      company: 'JoinX Technology',
      url: 'https://joinx.co/',
      desc: 'Owned front-end architecture for e-commerce, admin and fintech clients — from tech selection and API contracts to production stability.',
      tags: ['Architecture', 'State Mgmt', 'API Design']
    },
    {
      period: '2025.02 — Present',
      role: 'Senior Front-End Engineer',
      company: 'Ruten',
      url: 'https://www.ruten.com.tw/',
      desc: 'Ship high-traffic campaign features on a major e-commerce platform, improve LCP / CLS, and lead incremental refactoring of legacy modules.',
      tags: ['Core Web Vitals', 'Refactoring', 'Scrum'],
      current: true
    }
  ]

  const heading = 'Tools I build with.'
  const { output: headingOutput, setText } = useTextScramble({ duration: 40 })

  const root = ref<HTMLElement | null>(null)
  const groupEls = ref<HTMLElement[]>([])
  const fillEls = ref<HTMLElement[]>([])
  const lineEl = ref<HTMLElement | null>(null)
  const stepEls = ref<HTMLElement[]>([])

  // 把本幕的捲動補間接到主 timeline 的 at 位置（scrub 驅動，可正反向播放）
  const addTo = (tl: gsap.core.Timeline, at: number) => {
    tl
      // 整塊顯現
      .fromTo(root.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, at)
      // 技能分組由下往上依序浮現
      .fromTo(groupEls.value, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1 }, at)
      // 進度條由左往右填滿
      .fromTo(fillEls.value, { scaleX: 0 }, { scaleX: 1, duration: 0.5, stagger: 0.04, ease: 'power2.out' }, at + 0.15)
      // 時間軸：直線由上往下畫出，各節點依序出現
      .fromTo(lineEl.value, { scaleY: 0 }, { scaleY: 1, duration: 1 }, at)
      .fromTo(stepEls.value, { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.25, stagger: 0.25 }, at + 0.05)
  }

  const enter = () => setText(heading) // 標題亂數解碼進場
  const leave = () => setText('') // 標題亂碼解散

  defineExpose({ addTo, enter, leave })
</script>

<template>
  <!-- 初始 invisible：在主 timeline 建立前（loading 期間）保持隱藏，避免閃現 -->
  <section ref="root" class="invisible absolute inset-0 grid grid-cols-3 pointer-events-none">
    <!-- 左 2/3：標題 + 技能矩陣 -->
    <div class="col-span-2 flex flex-col justify-between p-6">
      <header>
        <p class="text-xs tracking-widest opacity-70">[ 02 ] SKILLS &amp; JOURNEY</p>
        <h2
          class="mt-3 min-h-[2em] text-4xl md:text-5xl lg:text-6xl uppercase leading-none"
          v-html="headingOutput"
        ></h2>
      </header>

      <div class="grid grid-cols-2 gap-x-10 gap-y-8">
        <div v-for="(group, i) in skillGroups" :key="group.title" ref="groupEls">
          <div class="s-line flex justify-between border-b-[0.5px] pb-2 mb-3 text-xs font-bold">
            <span>{{ group.title }}</span>
            <span class="opacity-70">0{{ i + 1 }}</span>
          </div>
          <ul class="space-y-2.5">
            <li
              v-for="item in group.items"
              :key="item.name"
              class="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 text-xs"
            >
              <span class="truncate">{{ item.name }}</span>
              <span class="skill-track">
                <span ref="fillEls" class="skill-fill" :style="{ width: `${item.level}%` }"></span>
              </span>
              <span class="text-right tabular-nums opacity-70">{{ item.level }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 右 1/3：經歷時間軸 -->
    <div class="s-line flex flex-col border-l-[0.5px] p-6">
      <p class="flex justify-between text-xs tracking-widest opacity-70">
        <span>TIMELINE</span>
        <span>2017 — NOW</span>
      </p>
      <ol class="relative mt-6 mb-1 flex flex-1 flex-col justify-between pl-6">
        <span ref="lineEl" class="absolute left-0 top-1 bottom-1 w-px bg-current origin-top"></span>
        <li v-for="step in timeline" :key="step.period" ref="stepEls" class="relative">
          <!-- 菱形節點壓在時間軸直線上；目前任職者為實心並加上脈衝光暈 -->
          <span
            class="node absolute -left-6 top-0.5 size-2 -translate-x-1/2 rotate-45 border border-current"
            :class="{ 'is-current bg-current': step.current }"
          ></span>
          <p class="text-[10px] tracking-widest tabular-nums opacity-70 uppercase">{{ step.period }}</p>
          <h3 class="mt-1.5 text-sm lg:text-base font-bold leading-tight">{{ step.role }}</h3>
          <!-- 公司：小 icon + 名稱，有官網時為外部連結（另開分頁） -->
          <component
            :is="step.url ? 'a' : 'span'"
            :href="step.url"
            :target="step.url ? '_blank' : undefined"
            :rel="step.url ? 'noopener noreferrer' : undefined"
            class="company mt-1 inline-flex items-center gap-1.5 text-[11px] tracking-wide"
            :class="{ 'is-link pointer-events-auto': step.url }"
          >
            <span class="company-icon">
              <img v-if="step.logo" :src="step.logo" :alt="`${step.company} logo`" />
              <template v-else>{{ step.company[0] }}</template>
            </span>
            <span class="company-name">{{ step.company }}</span>
            <span v-if="step.url" class="company-arrow" aria-hidden="true">↗</span>
          </component>
          <p class="mt-2 text-xs leading-relaxed opacity-80">{{ step.desc }}</p>
          <!-- 關鍵字標籤：視窗高度不足時隱藏，避免四段經歷擠壓重疊 -->
          <ul class="mt-2 flex flex-wrap gap-1.5 [@media(max-height:820px)]:hidden">
            <li
              v-for="tag in step.tags"
              :key="tag"
              class="s-line border-[0.5px] px-1.5 py-0.5 text-[10px] leading-none"
            >
              {{ tag }}
            </li>
          </ul>
        </li>
      </ol>
    </div>
  </section>
</template>

<style lang="scss" scoped>
  /* 分隔線與 Panel 共用主題變數（scoped 樣式不會繼承 Panel 的 .p-line） */
  .s-line {
    border-color: var(--panel-line, rgb(255 255 255 / 0.5));
  }

  /* 分段式 HUD 進度條：以 mask 切出格子，底軌與填色共用同一組格線 */
  .skill-track {
    position: relative;
    display: block;
    height: 6px;
    background: color-mix(in srgb, currentColor 20%, transparent);
    mask: repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 8px);
  }

  .skill-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: currentColor;
    transform-origin: left;
  }

  /* 公司列：預設半透明低調呈現，連結 hover 時提亮並讓 logo 恢復原色 */
  .company {
    opacity: 0.6;
    transition: opacity 0.3s;

    &.is-link:hover {
      opacity: 1;

      .company-name {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .company-arrow {
        transform: translate(2px, -2px);
      }

      .company-icon img {
        filter: none;
      }
    }
  }

  /* 公司小 icon：固定 14px 方框；無 logo 時顯示首字母 */
  .company-icon {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 14px;
    height: 14px;
    border: 0.5px solid currentColor;
    border-radius: 2px;
    font-size: 9px;
    line-height: 1;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: grayscale(1) brightness(1.6); /* 平時去色融入 HUD 風格，hover 才顯示品牌色 */
      transition: filter 0.3s;
    }

    &:has(img) {
      border: 0;
      background: #fff; /* logo 多為彩色/深色，墊白底確保在暗背景上可辨識 */
    }
  }

  .company-arrow {
    transition: transform 0.3s;
  }

  /* 目前任職節點：向外擴散的脈衝光暈 */
  .node.is-current::after {
    content: '';
    position: absolute;
    inset: -1px;
    border: 1px solid currentColor;
    animation: node-pulse 1.8s ease-out infinite;
  }

  @keyframes node-pulse {
    from {
      transform: scale(1);
      opacity: 0.8;
    }
    to {
      transform: scale(3);
      opacity: 0;
    }
  }

  :deep(.scramble-dud) {
    opacity: 0.7;
  }
</style>
