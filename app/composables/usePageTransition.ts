/**
 * 換頁轉場的控制介面：PageTransition 元件掛載時註冊實際的動畫，
 * plugins/page-transition.client.ts 在路由切換時呼叫 cover() / reveal()。
 * 元件尚未掛載（或在伺服器端）時兩者都直接結束，不會卡住換頁。
 */

type TransitionHandlers = {
  cover: (path: string) => Promise<void> // 方塊蓋滿整個畫面（完成後 resolve）
  reveal: () => Promise<void> // 方塊退去、露出新頁面
}

let handlers: TransitionHandlers | null = null

export const usePageTransition = () => ({
  register: (value: TransitionHandlers) => {
    handlers = value
    return () => {
      if (handlers === value) handlers = null
    }
  },
  cover: (path: string) => handlers?.cover(path) ?? Promise.resolve(),
  reveal: () => handlers?.reveal() ?? Promise.resolve()
})
