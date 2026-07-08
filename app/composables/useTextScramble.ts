interface ScrambleOptions {
  // 用來當作亂碼的符號集合
  chars?: string
  // 整體演出的影格數基準（數字越大解碼越慢）
  duration?: number
}

interface Queue {
  from: string // 原本的字元
  to: string // 確定後的字元
  start: number // 開始亂碼的影格
  end: number // 確定的影格
  char: string // 目前顯示中的隨機字元
}

/**
 * 文字亂數（Decode/解碼）效果
 * Text Scramble / Decode / Decrypt text effect / Glitch decode
 * 先讓文字變成隨機符號跳動閃爍，再由左至右逐字確定成原本的文字。
 */
export function useTextScramble(options: ScrambleOptions = {}) {
  const chars = options.chars ?? '!<>-_\\/[]{}—=+*^?#________'
  const duration = options.duration ?? 40

  // 要顯示在畫面上的字串（用它綁定到 template）
  const output = ref('')

  let frame = 0
  let frameId = 0
  let queue: Queue[] = []
  let resolvePromise: (() => void) | null = null

  const randomChar = () => chars[Math.floor(Math.random() * chars.length)]

  function update() {
    let complete = 0
    let html = ''

    for (const item of queue) {
      if (frame >= item.end) {
        // 已確定：顯示原本的字元
        complete++
        html += item.to
      } else if (frame >= item.start) {
        // 亂碼中：以一定機率替換隨機符號，製造閃爍跳動感
        if (!item.char || Math.random() < 0.28) {
          item.char = randomChar()
        }
        html += `<span class="scramble-dud">${item.char}</span>`
      } else {
        // 還沒輪到
        html += item.from
      }
    }

    output.value = html

    if (complete === queue.length) {
      // 全部字元皆已確定 → 結束
      resolvePromise?.()
      resolvePromise = null
      return
    }

    frame++
    frameId = requestAnimationFrame(update)
  }

  /** 以亂數解碼方式顯示指定文字。回傳一個在完成時 resolve 的 Promise。 */
  function setText(newText: string) {
    const oldText = output.value.replace(/<[^>]*>/g, '')
    const length = Math.max(oldText.length, newText.length)

    queue = []
    for (let i = 0; i < length; i++) {
      const from = oldText[i] ?? ''
      const to = newText[i] ?? ''
      const start = Math.floor(Math.random() * duration)
      const end = start + Math.floor(Math.random() * duration)
      queue.push({ from, to, start, end, char: '' })
    }

    cancelAnimationFrame(frameId)
    frame = 0
    const promise = new Promise<void>((resolve) => (resolvePromise = resolve))
    update()
    return promise
  }

  // 元件卸載時做清理
  onBeforeUnmount(() => cancelAnimationFrame(frameId))

  return { output, setText }
}
