// Articles 頁的分類與文章清單：已發佈的文章來自 shared/posts/（自動依分類排在各章最前面），
// 其餘為規劃中的假內容（之後寫好文章就移到 shared/posts/）
import { postSummaries, formatDate } from './posts'

export type ArticleStatus = 'published' | 'draft' | 'planned'

export interface ArticleItem {
  title: string
  excerpt: string
  date: string // YYYY.MM
  readTime?: string // 例如 6 min read
  status: ArticleStatus
  link?: string // 有文章頁之後填入
}

export interface ArticleChapter {
  key: string // 頂部選單與錨點用
  index: string // 章節編號，例如 01
  label: string // 頂部選單的名稱
  title: string // 章節大標
  intro: string // 章節簡介（標題下方的段落）
  icon: 'code' | 'wave' | 'frame' | 'path' // 右側的線條圖示
  note: { heading: string; text: string } // 章節底部的補充說明格
  tags: string[] // 章節底部的標籤
  articles: ArticleItem[]
}

const CHAPTERS: ArticleChapter[] = [
  {
    key: 'frontend',
    index: '01',
    label: 'Front-end',
    title: 'Front-end',
    intro:
      'Notes from building large Vue / Nuxt products — architecture, performance budgets and the small decisions that keep a codebase calm as it grows.',
    icon: 'code',
    note: { heading: 'Why write it down', text: 'Most lessons are learned in the middle of a deadline. Writing them down is how they survive the next project.' },
    tags: ['Vue', 'Nuxt', 'TypeScript', 'Performance'],
    articles: [
      {
        title: 'Keeping LCP under 2s on a content-heavy e-commerce home page',
        excerpt: 'Image priorities, critical CSS and the one script that cost us 800ms — a walkthrough of a real performance audit.',
        date: '2026.12',
        readTime: '8 min read',
        status: 'draft'
      },
      {
        title: 'Composables that age well',
        excerpt: 'Patterns for Vue composables that stay readable after a year: naming, return shapes and when not to extract.',
        date: '2027.01',
        readTime: '6 min read',
        status: 'planned'
      },
      {
        title: 'SSR, hydration and the bugs in between',
        excerpt: 'Seeded randomness, client-only components and other ways to keep the server and the browser in agreement.',
        date: '2027.02',
        status: 'planned'
      }
    ]
  },
  {
    key: 'motion',
    index: '02',
    label: 'Motion',
    title: 'Motion',
    intro:
      'Scroll storytelling with GSAP — timelines, scrubbing and the math behind interactions that feel smooth instead of busy.',
    icon: 'wave',
    note: { heading: 'Motion with a purpose', text: 'Every animation on this site answers one question: what should the eye look at next?' },
    tags: ['GSAP', 'ScrollTrigger', 'Three.js', 'Canvas'],
    articles: [
      {
        title: 'One master timeline for a whole page',
        excerpt: 'How this portfolio drives five acts with a single scrubbed ScrollTrigger — and what breaks when you refresh it.',
        date: '2026.12',
        readTime: '10 min read',
        status: 'draft'
      },
      {
        title: 'Building a ferris-wheel carousel with CSS variables',
        excerpt: 'Rotating cards around a far-away origin, snapping, and keeping it all scroll-driven.',
        date: '2027.01',
        status: 'planned'
      }
    ]
  },
  {
    key: 'design',
    index: '03',
    label: 'Design',
    title: 'Design',
    intro:
      'Layout systems, typography and the TechFrame language — designing in the browser when the designer and the developer are the same person.',
    icon: 'frame',
    note: { heading: 'Design in code', text: 'Corners, lines and grids that are cheap to change are the ones that get iterated on.' },
    tags: ['UI', 'Typography', 'Layout', 'SVG'],
    articles: [
      {
        title: 'TechFrame: an SVG clip-path frame system',
        excerpt: 'Round, bevel and notch corners from one component — and why ResizeObserver beats CSS for this job.',
        date: '2027.01',
        readTime: '7 min read',
        status: 'draft'
      },
      {
        title: 'Irregular grids that still feel organised',
        excerpt: 'Borrowing the thin-line grids of sci-fi interfaces without losing readability.',
        date: '2027.02',
        status: 'planned'
      }
    ]
  },
  {
    key: 'notes',
    index: '04',
    label: 'Notes',
    title: 'Field Notes',
    intro: 'Breaking, mountain trails and the moments between the beats — what happens away from the keyboard, and what it teaches back.',
    icon: 'path',
    note: { heading: 'Off the screen', text: 'Dance taught me rhythm and patience long before code did. These notes are where the two meet.' },
    tags: ['Breaking', 'Travel', 'Life'],
    articles: [
      {
        title: 'What a cypher taught me about code review',
        excerpt: 'Taking turns, reading the room and giving feedback that keeps people dancing.',
        date: '2027.01',
        readTime: '5 min read',
        status: 'draft'
      },
      {
        title: 'Notes from a waterfall trail',
        excerpt: 'A slow day outside, and why the best ideas show up when you stop looking for them.',
        date: '2027.02',
        status: 'planned'
      }
    ]
  }
]

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  published: 'Published',
  draft: 'In progress',
  planned: 'Planned'
}

// 合併已發佈的文章（shared/posts/）到對應的分類最前面
export const ARTICLE_CHAPTERS: ArticleChapter[] = CHAPTERS.map((chapter) => ({
  ...chapter,
  articles: [
    ...postSummaries()
      .filter((post) => post.category === chapter.key)
      .map(
        (post): ArticleItem => ({
          title: post.title,
          excerpt: post.excerpt,
          date: formatDate(post.publishedAt).slice(0, 7),
          readTime: post.readTime,
          status: 'published',
          link: post.link
        })
      ),
    ...chapter.articles
  ]
}))
