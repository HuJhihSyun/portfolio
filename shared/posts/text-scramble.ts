import type { Post } from './types'

/**
 * 第一篇文章：TextScramble 解碼文字效果（中文教學）。
 * 內容以本站實際使用的 app/composables/useTextScramble.ts 為範本。
 * 程式碼字串用樣板字串撰寫：內容裡的反引號與 ${ 需跳脫（\` 與 \${）。
 */
export const textScramblePost: Post = {
  id: 'post-0001',
  slug: 'text-scramble',
  title: '用 Vue Composable 打造 TextScramble 解碼文字效果',
  excerpt:
    '從原理拆解到完整實作：用一個不到 80 行的 Vue 3 composable，做出文字先亂碼閃爍、再逐字解碼成原文的效果，並兼顧 SEO、無障礙與中文顯示。',
  category: 'motion',
  tags: ['Vue 3', 'Composable', 'TypeScript', 'Animation'],
  author: { name: 'Jhih-Syun Hu' },
  publishedAt: '2026-11-27T10:00:00+08:00',
  status: 'published',
  content: {
    time: 1795770000000,
    version: '2.30.0',
    blocks: [
      {
        id: 'intro-1',
        type: 'paragraph',
        data: {
          text: '這個網站的標題、Gallery 的說明文字、Contact 的 Console 小字，都有一種「先變成一串亂碼、再一個字一個字解碼回原文」的效果，常被稱為 <b>Text Scramble</b> 或 <b>Decode effect</b>。這篇會從原理開始，一步一步寫出本站實際在用的 <code>useTextScramble</code> composable。'
        }
      },
      {
        id: 'intro-demo',
        type: 'demo',
        data: { component: 'text-scramble-basic', caption: '成果：點擊「下一句」切換文字，每次都會重新解碼。' }
      },
      {
        id: 'h-principle',
        type: 'header',
        data: { text: '原理拆解', level: 2 }
      },
      {
        id: 'principle-1',
        type: 'paragraph',
        data: {
          text: '把動畫想成一格一格的影格（frame）。每一個字元都有自己的「開始亂碼」與「確定」時間點，兩者都是隨機的，所以每個字解碼的時機都不一樣，看起來才會有跳動感。'
        }
      },
      {
        id: 'principle-list',
        type: 'list',
        data: {
          style: 'ordered',
          items: [
            '<b>還沒輪到</b>（目前影格 &lt; start）：顯示原本的字。',
            '<b>亂碼中</b>（start ≤ 目前影格 &lt; end）：顯示隨機符號，並不時換成另一個符號。',
            '<b>已確定</b>（目前影格 ≥ end）：顯示目標的字。',
            '所有字元都確定後，停止動畫。'
          ]
        }
      },
      {
        id: 'principle-2',
        type: 'paragraph',
        data: {
          text: '每一格都把所有字元的狀態組成一個字串，交給 Vue 的 <code>ref</code> 去更新畫面；換影格則交給 <code>requestAnimationFrame</code>，跟著螢幕的更新頻率走，比 <code>setInterval</code> 更順也更省電。'
        }
      },
      {
        id: 'h-step1',
        type: 'header',
        data: { text: '步驟一：建立 composable 骨架', level: 2 }
      },
      {
        id: 'step1-1',
        type: 'paragraph',
        data: {
          text: '先決定對外的介面：傳入亂碼字元集 <code>chars</code> 與解碼長度 <code>duration</code>，回傳綁定畫面用的 <code>output</code> 與觸發動畫的 <code>setText()</code>。'
        }
      },
      {
        id: 'step1-code',
        type: 'code',
        data: {
          language: 'ts',
          filename: 'composables/useTextScramble.ts',
          code: `interface ScrambleOptions {
  chars?: string    // 亂碼使用的符號
  duration?: number // 解碼長度（影格數），越大越慢
}

export function useTextScramble(options: ScrambleOptions = {}) {
  const chars = options.chars ?? '!<>-_\\\\/[]{}—=+*^?#________'
  const duration = options.duration ?? 40

  const output = ref('') // 綁定到 template 的字串

  function setText(newText: string) {
    // 下一步實作
  }

  return { output, setText }
}`
        }
      },
      {
        id: 'step1-2',
        type: 'paragraph',
        data: {
          text: '字元集裡刻意放了很多底線 <code>_</code>：底線出現的機率較高，亂碼看起來比較「乾淨」，不會整排都是密密麻麻的符號。'
        }
      },
      {
        id: 'h-step2',
        type: 'header',
        data: { text: '步驟二：為每個字元排好時間表', level: 2 }
      },
      {
        id: 'step2-1',
        type: 'paragraph',
        data: {
          text: '呼叫 <code>setText()</code> 時，比對「目前顯示的文字」與「新的文字」，取兩者較長的長度，為每個位置建立一筆資料：從哪個字變成哪個字、第幾格開始亂碼、第幾格確定。'
        }
      },
      {
        id: 'step2-code',
        type: 'code',
        data: {
          language: 'ts',
          filename: 'composables/useTextScramble.ts',
          code: `interface QueueItem {
  from: string  // 原本的字
  to: string    // 目標的字
  start: number // 第幾影格開始亂碼
  end: number   // 第幾影格確定
  char: string  // 目前顯示的亂碼
}

let queue: QueueItem[] = []
let frame = 0
let frameId = 0

function setText(newText: string) {
  // 去掉上一次留下的 <span> 標籤，取得純文字
  const oldText = output.value.replace(/<[^>]*>/g, '')
  const length = Math.max(oldText.length, newText.length)

  queue = []
  for (let i = 0; i < length; i++) {
    const start = Math.floor(Math.random() * duration)
    const end = start + Math.floor(Math.random() * duration)
    queue.push({ from: oldText[i] ?? '', to: newText[i] ?? '', start, end, char: '' })
  }

  cancelAnimationFrame(frameId) // 中斷上一次還沒播完的動畫
  frame = 0
  update()
}`
        }
      },
      {
        id: 'step2-note',
        type: 'warning',
        data: {
          tone: 'tip',
          title: '為什麼取較長的長度？',
          message:
            '新文字比舊文字短時，多出來的位置 <code>to</code> 是空字串，解碼完就會消失；新文字比較長時，<code>from</code> 是空字串，字會從無到有長出來。兩種情況用同一套邏輯就能處理。'
        }
      },
      {
        id: 'h-step3',
        type: 'header',
        data: { text: '步驟三：逐影格更新畫面', level: 2 }
      },
      {
        id: 'step3-1',
        type: 'paragraph',
        data: {
          text: '<code>update()</code> 每一格跑一次：依照目前影格判斷每個字元的狀態，組成字串後更新 <code>output</code>。亂碼字元用 <code>&lt;span class="scramble-dud"&gt;</code> 包起來，方便用 CSS 調淡。'
        }
      },
      {
        id: 'step3-code',
        type: 'code',
        data: {
          language: 'ts',
          filename: 'composables/useTextScramble.ts',
          code: `const randomChar = () => chars[Math.floor(Math.random() * chars.length)]

function update() {
  let complete = 0
  let html = ''

  for (const item of queue) {
    if (frame >= item.end) {
      complete++
      html += item.to // 已確定：顯示目標字
    } else if (frame >= item.start) {
      // 亂碼中：約 28% 的機率換一個符號，閃爍才不會太快
      if (!item.char || Math.random() < 0.28) item.char = randomChar()
      html += \`<span class="scramble-dud">\${item.char}</span>\`
    } else {
      html += item.from // 還沒輪到：維持原本的字
    }
  }

  output.value = html
  if (complete === queue.length) return // 全部確定就停止

  frame++
  frameId = requestAnimationFrame(update)
}`
        }
      },
      {
        id: 'step3-2',
        type: 'paragraph',
        data: {
          text: '<code>Math.random() &lt; 0.28</code> 這個數字是調出來的：每一格都換符號會閃得太快、像雜訊；換得太少又像當機。大約三到四格換一次，跳動感最自然。'
        }
      },
      {
        id: 'h-step4',
        type: 'header',
        data: { text: '步驟四：回傳 Promise 並做好清理', level: 2 }
      },
      {
        id: 'step4-1',
        type: 'paragraph',
        data: {
          text: '讓 <code>setText()</code> 回傳一個在解碼完成時 resolve 的 Promise，就能用 <code>await</code> 串接多段文字；元件卸載時記得取消 <code>requestAnimationFrame</code>，避免動畫在背景繼續跑。'
        }
      },
      {
        id: 'step4-code',
        type: 'code',
        data: {
          language: 'ts',
          filename: 'composables/useTextScramble.ts',
          code: `let resolvePromise: (() => void) | null = null

function setText(newText: string) {
  // ……建立 queue（同步驟二）
  const promise = new Promise<void>((resolve) => (resolvePromise = resolve))
  update()
  return promise
}

// update() 裡，全部確定時通知完成
if (complete === queue.length) {
  resolvePromise?.()
  resolvePromise = null
  return
}

// 元件卸載時停止動畫
onBeforeUnmount(() => cancelAnimationFrame(frameId))`
        }
      },
      {
        id: 'step4-code2',
        type: 'code',
        data: {
          language: 'ts',
          filename: '依序播放多段文字',
          code: `await setText('Loading…')
await setText('Decoding…')
await setText('Hello, Syun.')`
        }
      },
      {
        id: 'h-use',
        type: 'header',
        data: { text: '在元件中使用', level: 2 }
      },
      {
        id: 'use-1',
        type: 'paragraph',
        data: {
          text: '因為 <code>output</code> 裡有 <code>&lt;span&gt;</code> 標籤，要用 <code>v-html</code> 渲染。同時放一份完整的原文給搜尋引擎與螢幕閱讀器，動畫那份則用 <code>aria-hidden</code> 隱藏，兼顧 SEO 與無障礙。'
        }
      },
      {
        id: 'use-code',
        type: 'code',
        data: {
          language: 'vue',
          filename: 'components/HeroTitle.vue',
          code: `<script setup lang="ts">
const { output, setText } = useTextScramble({ duration: 30 })

onMounted(() => setText('Hello, Syun.'))
</script>

<template>
  <h1 class="title">
    <!-- 給搜尋引擎與螢幕閱讀器的完整文字 -->
    <span class="sr-only">Hello, Syun.</span>
    <!-- 動畫用的文字（含亂碼 span），對輔助科技隱藏 -->
    <span aria-hidden="true" v-html="output"></span>
  </h1>
</template>

<style scoped>
.title :deep(.scramble-dud) {
  opacity: 0.5; /* 亂碼字元稍微淡一點 */
}
</style>`
        }
      },
      {
        id: 'use-warning',
        type: 'warning',
        data: {
          tone: 'warning',
          title: 'v-html 只用在自己的文字',
          message:
            '<code>update()</code> 會把字元直接組進 HTML。如果文字來自使用者輸入，請先把 <code>&lt;</code>、<code>&gt;</code>、<code>&amp;</code> 換掉（例如換成全形符號），避免被插入 HTML。下方 Playground 的輸入框就是這樣處理的。'
        }
      },
      {
        id: 'h-hover',
        type: 'header',
        data: { text: '進階一：滑鼠移入時重播', level: 2 }
      },
      {
        id: 'hover-1',
        type: 'paragraph',
        data: {
          text: '選單、按鈕很適合在 hover 時重播一次。小技巧：一開始先把原文直接塞進 <code>output</code>，畫面就不會是空的；移入時再呼叫 <code>setText()</code> 解碼成同一段文字。'
        }
      },
      {
        id: 'hover-code',
        type: 'code',
        data: {
          language: 'vue',
          filename: 'components/ScrambleLink.vue',
          code: `<script setup lang="ts">
const props = defineProps<{ label: string; to: string }>()
const { output, setText } = useTextScramble({ duration: 16 })

output.value = props.label // 一開始直接顯示原文
const replay = () => setText(props.label)
</script>

<template>
  <NuxtLink :to="to" @mouseenter="replay">
    <span class="sr-only">{{ label }}</span>
    <span aria-hidden="true" v-html="output"></span>
  </NuxtLink>
</template>`
        }
      },
      {
        id: 'hover-demo',
        type: 'demo',
        data: { component: 'text-scramble-hover', caption: '成果：把滑鼠移到選單上，每個項目都會重新解碼。' }
      },
      {
        id: 'h-params',
        type: 'header',
        data: { text: '進階二：調整參數與中文顯示', level: 2 }
      },
      {
        id: 'params-1',
        type: 'paragraph',
        data: {
          text: '兩個參數就能做出完全不同的個性：<code>duration</code> 決定節奏，<code>chars</code> 決定質感。'
        }
      },
      {
        id: 'params-table',
        type: 'table',
        data: {
          withHeadings: true,
          content: [
            ['參數', '預設值', '效果'],
            ['<code>duration</code>', '40', '開始與確定時間的隨機範圍（影格）。16～24 適合按鈕 hover，30～40 適合標題進場。'],
            ['<code>chars</code>', '<code>!&lt;&gt;-_\\/[]{}…</code>', '亂碼字元集。改成 <code>01</code> 像二進位、改成片假名像駭客電影。'],
            ['亂碼頻率', '0.28', '每一格換符號的機率（寫在 update 裡），越大閃得越快。']
          ]
        }
      },
      {
        id: 'params-cjk',
        type: 'warning',
        data: {
          tone: 'note',
          title: '中文會「跳寬度」？',
          message:
            '半形符號比中文字窄，解碼中文時整行寬度會一直伸縮。可以改用全形符號當字元集（例如 <code>＃＊＋－／＼＿</code>），或用等寬字型；若版面不能晃動，也可以先放一份透明的原文撐住寬度，再把動畫疊在上面。'
        }
      },
      {
        id: 'params-demo',
        type: 'demo',
        data: { component: 'text-scramble-playground', caption: '成果：輸入文字、調整參數後按「解碼」。試試中文搭配「全形符號」。' }
      },
      {
        id: 'h-scroll',
        type: 'header',
        data: { text: '進階三：捲動到畫面時才播放', level: 2 }
      },
      {
        id: 'scroll-1',
        type: 'paragraph',
        data: {
          text: '長頁面裡的標題，捲到畫面中才解碼會更有儀式感。搭配 GSAP 的 ScrollTrigger（或原生的 <code>IntersectionObserver</code>）設定只播一次即可，本站 Articles 頁的章節大標就是這樣做的。'
        }
      },
      {
        id: 'scroll-code',
        type: 'code',
        data: {
          language: 'ts',
          code: `ScrollTrigger.create({
  trigger: titleEl.value,
  start: 'top 80%',
  once: true, // 只播一次
  onEnter: () => setText('Moments between the beats.')
})`
        }
      },
      {
        id: 'h-perf',
        type: 'header',
        data: { text: '效能與無障礙的小提醒', level: 2 }
      },
      {
        id: 'perf-list',
        type: 'list',
        data: {
          style: 'unordered',
          items: [
            '<b>同時播放的數量</b>：每個實例每一格都會更新一次字串，十幾個一起播沒問題，上百個就要考慮錯開時間。',
            '<b>減少動態效果</b>：使用者開啟系統的「減少動態效果」時，直接顯示文字即可（見下方程式碼）。',
            '<b>一定要清理</b>：元件卸載時取消 <code>requestAnimationFrame</code>，換頁後才不會在背景繼續更新。',
            '<b>SEO</b>：動畫一開始是空字串或亂碼，所以一定要另外放一份完整原文（<code>sr-only</code>）。'
          ]
        }
      },
      {
        id: 'perf-code',
        type: 'code',
        data: {
          language: 'ts',
          filename: '尊重「減少動態效果」設定',
          code: `function setText(newText: string) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    output.value = newText // 直接顯示，不播動畫
    return Promise.resolve()
  }
  // ……原本的解碼流程
}`
        }
      },
      {
        id: 'h-summary',
        type: 'header',
        data: { text: '總結', level: 2 }
      },
      {
        id: 'summary-1',
        type: 'paragraph',
        data: {
          text: 'Text Scramble 的核心只有三件事：<b>為每個字元排一張隨機時間表</b>、<b>用 requestAnimationFrame 逐格組字串</b>、<b>在適當的時機清理</b>。包成 composable 之後，標題、按鈕、Console 小字都能用同一套邏輯，只要調 <code>duration</code> 與 <code>chars</code> 就能變化出不同的個性。'
        }
      },
      {
        id: 'summary-quote',
        type: 'quote',
        data: {
          text: '好的動態效果，是讓眼睛知道下一步該看哪裡。',
          caption: '本站的動畫原則'
        }
      }
    ]
  }
}
