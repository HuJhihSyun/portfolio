/**
 * 全站自訂游標（AppCursor）的模式：各頁可暫時切換成特殊樣式，離開時切回預設。
 *   - default：全站預設（圓環＋中心方點，hover 時放大）
 *   - progress：圓形進度條（例如 Gallery 首屏的卡片輪盤），中心顯示 index、灰字顯示 meta、下方顯示 label
 * 使用方式：
 *   const cursor = useCursorMode()
 *   cursor.set('progress', { index, meta, label })  // 只在內容改變時才會觸發重繪
 *   cursor.setProgress(0.42)                         // 進度 0～1，捲動時每幀呼叫也沒關係（直接寫入 DOM，不經 Vue 響應式）
 *   cursor.reset()
 */

export type CursorModeName = 'default' | 'progress'

export interface CursorModeState {
  name: CursorModeName
  index: string // 圓環中心的編號（例如 03）
  meta: string // 灰字第二行（例如 POST 03 / 12）
  label: string // 圓環下方的主文字（例如 SCROLL）
}

const DEFAULT: CursorModeState = { name: 'default', index: '', meta: '', label: '' }

// 進度不放在響應式狀態裡：每幀更新若經過 Vue 會讓整個游標元件重新渲染，改由 AppCursor 註冊的函式直接改 DOM
let progressHandler: ((progress: number) => void) | null = null

export const useCursorMode = () => {
  const mode = useState<CursorModeState>('cursor-mode', () => ({ ...DEFAULT }))

  /** 切換模式並更新資料（內容沒變就不觸發重繪） */
  const set = (name: CursorModeName, data: Partial<Omit<CursorModeState, 'name'>> = {}) => {
    const next = { ...mode.value, ...data, name }
    const changed = (Object.keys(next) as (keyof CursorModeState)[]).some((key) => next[key] !== mode.value[key])
    if (changed) mode.value = next
  }

  const setProgress = (progress: number) => progressHandler?.(progress)

  const reset = () => {
    if (mode.value.name !== 'default') mode.value = { ...DEFAULT }
  }

  /** AppCursor 內部使用：註冊進度的處理函式 */
  const onProgress = (handler: (progress: number) => void) => {
    progressHandler = handler
    return () => {
      if (progressHandler === handler) progressHandler = null
    }
  }

  return { mode, set, setProgress, reset, onProgress }
}
