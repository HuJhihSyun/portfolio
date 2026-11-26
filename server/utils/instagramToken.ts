import { createHash } from 'node:crypto'

/**
 * Instagram（透過 Facebook 登入）存取權杖的自動維護。
 *
 * 權杖種類與效期（Meta 規則）：
 *   - 短效使用者權杖：約 1～2 小時
 *   - 長效使用者權杖：約 60 天，Facebook 沒有「延長」端點，到期就要重新登入產生
 *   - 粉專（Page）權杖：由長效使用者權杖換得，本身不會過期（debug_token 回傳 expires_at = 0），
 *     但改密碼、失去粉專管理權限或移除 App 時會失效
 *
 * 維護流程（每 CHECK_INTERVAL 最多檢查一次，取得貼文時順便執行）：
 *   1. 以 debug_token 查詢目前權杖的種類與到期時間（需要 App 編號與密鑰）
 *   2. 已是不會過期的權杖 → 不需處理
 *   3. 使用者權杖 → 先確保為長效（fb_exchange_token），再透過 /me/accounts 換成連結此 Instagram 帳號的粉專權杖（不會過期）
 *   4. 換不到粉專權杖時，到期前 REFRESH_BEFORE 內嘗試重新交換，並在 log 提醒剩餘天數
 * 換得的新權杖存在伺服器端的 data 儲存區（開發與一般 Node 部署為 .data/kv，已在 .gitignore），不會寫回 .env。
 * 若在 .env 換了新的權杖，會自動捨棄舊的儲存值、改用新的。
 */

const GRAPH = 'https://graph.facebook.com'
const STORE_KEY = 'instagram:token'
const CHECK_INTERVAL = 12 * 60 * 60 * 1000 // 每 12 小時最多檢查一次
const REFRESH_BEFORE = 10 * 24 * 60 * 60 // 到期前 10 天內嘗試重新交換（秒）

interface StoredToken {
  token: string
  source: string // .env 權杖的雜湊：.env 換了新權杖時，捨棄舊的儲存值
  type?: string // USER / PAGE
  expiresAt?: number // Unix 秒；0 = 不會過期
  checkedAt: number // 上次檢查時間（毫秒）
}

interface DebugTokenData {
  is_valid: boolean
  type?: string
  expires_at?: number
  error?: { message?: string }
}

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)
const daysLeft = (expiresAt?: number) =>
  expiresAt ? Math.round((expiresAt * 1000 - Date.now()) / 86_400_000) : Infinity

// Graph API 錯誤只記錄說明文字或狀態碼。
// 不可使用 err.message：ofetch 的錯誤訊息含完整網址，debug_token / 交換權杖的網址帶有 App 密鑰
const graphMessage = (err: unknown) => {
  const e = err as { data?: { error?: { message?: string } }; statusCode?: number; cause?: { code?: string } }
  return e.data?.error?.message ?? (e.statusCode ? `HTTP ${e.statusCode}` : (e.cause?.code ?? 'network error'))
}

let pending: Promise<string | null> | null = null // 同一時間只跑一次檢查

/** 取得目前可用的權杖（必要時先自動維護）；未設定權杖時回傳 null */
export const getInstagramToken = (): Promise<string | null> => {
  pending ??= resolveToken().finally(() => (pending = null))
  return pending
}

const resolveToken = async (): Promise<string | null> => {
  const { accessToken, appId, appSecret, apiVersion } = useRuntimeConfig().instagram
  if (!accessToken) return null

  const storage = useStorage('data')
  const source = hash(accessToken)
  let stored = await storage.getItem<StoredToken>(STORE_KEY)
  if (!stored || stored.source !== source) stored = { token: accessToken, source, checkedAt: 0 }

  // 沒有 App 編號 / 密鑰就無法查詢與交換權杖：直接使用現有權杖
  if (!appId || !appSecret) return stored.token
  if (Date.now() - stored.checkedAt < CHECK_INTERVAL) return stored.token

  try {
    stored = await maintain(stored, { appId, appSecret, apiVersion })
  } catch (err) {
    console.warn('[instagram-token] 權杖檢查失敗，暫時沿用現有權杖：', graphMessage(err))
    stored = { ...stored, checkedAt: Date.now() - CHECK_INTERVAL + 60 * 60 * 1000 } // 1 小時後再試
  }
  await storage.setItem(STORE_KEY, stored)
  return stored.token
}

type AppCreds = { appId: string; appSecret: string; apiVersion: string }

const debugToken = async (token: string, { appId, appSecret, apiVersion }: AppCreds) => {
  const res = await $fetch<{ data: DebugTokenData }>(`${GRAPH}/${apiVersion}/debug_token`, {
    query: { input_token: token, access_token: `${appId}|${appSecret}` },
    timeout: 10_000
  })
  return res.data
}

const maintain = async (stored: StoredToken, creds: AppCreds): Promise<StoredToken> => {
  const now = Date.now()
  const info = await debugToken(stored.token, creds)

  if (!info.is_valid) {
    console.error('[instagram-token] 權杖已失效，請重新產生並更新 .env：', info.error?.message ?? '')
    return { ...stored, type: info.type, expiresAt: info.expires_at, checkedAt: now }
  }

  // 不會過期的權杖（粉專權杖等）：不需處理
  if (info.expires_at === 0) return { ...stored, type: info.type, expiresAt: 0, checkedAt: now }

  let token = stored.token
  let expiresAt = info.expires_at

  if (info.type === 'USER') {
    // 1. 短效（剩不到 2 天）→ 先換成長效使用者權杖
    if (daysLeft(expiresAt) < 2) {
      const exchanged = await exchange(token, creds)
      token = exchanged.token
      expiresAt = exchanged.expiresAt ?? expiresAt
    }
    // 2. 換成連結此 Instagram 帳號的粉專權杖（不會過期）
    const pageToken = await findPageToken(token, creds)
    if (pageToken) {
      const pageInfo = await debugToken(pageToken, creds)
      if (pageInfo.is_valid) {
        console.info(
          `[instagram-token] 已換成粉專權杖（${pageInfo.expires_at === 0 ? '不會過期' : `剩 ${daysLeft(pageInfo.expires_at)} 天`}）`
        )
        return { ...stored, token: pageToken, type: pageInfo.type, expiresAt: pageInfo.expires_at, checkedAt: now }
      }
    }
  }

  // 3. 換不到粉專權杖：到期前嘗試重新交換，並提醒剩餘天數
  if (expiresAt && expiresAt - now / 1000 < REFRESH_BEFORE) {
    try {
      const exchanged = await exchange(token, creds)
      token = exchanged.token
      expiresAt = exchanged.expiresAt ?? expiresAt
    } catch (err) {
      console.warn('[instagram-token] 重新交換權杖失敗：', graphMessage(err))
    }
  }
  const left = daysLeft(expiresAt)
  if (left < 14) console.warn(`[instagram-token] 權杖剩 ${left} 天到期，請在到期前重新產生並更新 .env`)

  return { ...stored, token, type: info.type, expiresAt, checkedAt: now }
}

// 以 App 密鑰把使用者權杖換成長效權杖（約 60 天）
const exchange = async (token: string, { appId, appSecret, apiVersion }: AppCreds) => {
  const res = await $fetch<{ access_token: string; expires_in?: number }>(`${GRAPH}/${apiVersion}/oauth/access_token`, {
    query: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: token },
    timeout: 10_000
  })
  return {
    token: res.access_token,
    expiresAt: res.expires_in ? Math.floor(Date.now() / 1000) + res.expires_in : undefined
  }
}

// 從使用者管理的粉專中，找出連結到此 Instagram 帳號的粉專，取得它的權杖
const findPageToken = async (token: string, { apiVersion }: AppCreds) => {
  const { userId } = useRuntimeConfig().instagram
  try {
    const res = await $fetch<{ data: { access_token?: string; instagram_business_account?: { id: string } }[] }>(
      `${GRAPH}/${apiVersion}/me/accounts`,
      {
        query: { fields: 'access_token,instagram_business_account', limit: 100 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10_000
      }
    )
    return res.data.find((page) => page.instagram_business_account?.id === userId)?.access_token ?? null
  } catch (err) {
    console.warn('[instagram-token] 無法取得粉專權杖（可能缺少粉專相關權限）：', graphMessage(err))
    return null
  }
}

/** 權杖被 Instagram 拒絕時（例如過期）呼叫：下次取用時立即重新檢查 */
export const invalidateInstagramToken = async () => {
  const storage = useStorage('data')
  const stored = await storage.getItem<StoredToken>(STORE_KEY)
  if (stored) await storage.setItem(STORE_KEY, { ...stored, checkedAt: 0 })
}
