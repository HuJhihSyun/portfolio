/**
 * 外部資料來源的快取與防呆（Gallery 的 Instagram / Behance 共用）。
 *
 * 取得順序：
 *   1. live：快取在 freshFor 內直接回傳；過期則重新取得並存入快取
 *   2. stale：取不到（網路、資安工具阻擋、權杖過期、對方服務異常等）時，改用最近一次成功取得的資料（staleFor 內）
 *   3. fallback：都沒有時，回傳備用內容
 * 快取存在伺服器端的 data 儲存區（開發與一般 Node 部署為 .data/kv，已在 .gitignore）。
 */

export type SourceState = 'live' | 'stale' | 'fallback'

interface Cached<T> {
  data: T
  fetchedAt: number
}

interface CachedSourceOptions<T> {
  key: string // 儲存區的鍵
  label: string // log 前綴，例如 gallery/posts
  freshFor: number // 毫秒
  staleFor: number // 毫秒
  fetch: () => Promise<T>
  fallback: () => T
  // 取得失敗時呼叫：回傳要記錄的錯誤說明（不可含權杖、密鑰），也可在此做額外處理（例如讓權杖重新檢查）
  describeError?: (err: unknown) => string | Promise<string>
}

const pending = new Map<string, Promise<unknown>>() // 同一來源同一時間只取一次

const defaultDescribe = (err: unknown) => {
  const e = err as { statusCode?: number; cause?: { code?: string }; message?: string }
  return e.statusCode ? `HTTP ${e.statusCode}` : (e.cause?.code ?? e.message ?? 'unknown error')
}

export const cachedSource = async <T>(opts: CachedSourceOptions<T>): Promise<{ data: T; source: SourceState }> => {
  const storage = useStorage('data')
  const cached = await storage.getItem<Cached<T>>(opts.key)
  const age = cached ? Date.now() - cached.fetchedAt : Infinity
  if (cached && age < opts.freshFor) return { data: cached.data, source: 'live' }

  try {
    let job = pending.get(opts.key) as Promise<T> | undefined
    if (!job) {
      job = opts.fetch().finally(() => pending.delete(opts.key))
      pending.set(opts.key, job)
    }
    const data = await job
    await storage.setItem(opts.key, { data, fetchedAt: Date.now() } satisfies Cached<T>)
    return { data, source: 'live' }
  } catch (err) {
    const useStale = !!cached && age < opts.staleFor
    const reason = await (opts.describeError ?? defaultDescribe)(err)
    console.error(`[${opts.label}] 取得失敗，改用`, useStale ? '最近一次的資料' : '備用內容', '：', reason)
    if (useStale) return { data: cached.data, source: 'stale' }
    return { data: opts.fallback(), source: 'fallback' }
  }
}
