const message = ref('')

export const useGlobalLoading = () => {
  const loading = useState('global-loading', () => false)

  const start = (msg?: string) => {
    if (msg) message.value = msg
    loading.value = true
  }

  const finish = () => {
    loading.value = false
    message.value = '' // reset
  }

  /**
   * 開場 loading 結束後執行 cb：直接開啟頁面時等 AppLoading 播完（約 3 秒）；
   * 站內換頁時 loading 早已結束（layout 不會重播），立即執行。回傳取消函式（元件卸載時呼叫）
   */
  const onLoaded = (cb: () => void) => {
    if (!loading.value) {
      cb()
      return () => {}
    }
    const stop = watch(loading, (value) => {
      if (value) return
      stop()
      cb()
    })
    return stop
  }

  return { loading, start, finish, message, onLoaded }
}
