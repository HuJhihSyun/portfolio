import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { CONTACT_LIMITS, CONTACT_TOPICS, type ContactTopic } from '#shared/contact'

/**
 * POST /api/contact：聯絡表單寄信 API。
 * 驗證欄位後透過 Gmail SMTP（nodemailer）把表單內容寄到 runtimeConfig.mail.to；
 * 回信時直接按「回覆」即可回給填表人（replyTo 設為填表人的 Email）。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 簡易限流：同一 IP 在時間窗內最多送出 RATE_MAX 次。
// 存在記憶體中，適用單一 Node 程序；若改部署到多實例 / Serverless，需換成 Redis 等共享儲存才有效
const RATE_WINDOW = 10 * 60 * 1000
const RATE_MAX = 5
const hits = new Map<string, number[]>()

const isRateLimited = (ip: string) => {
  const now = Date.now()
  // 定期清掉已過期的 IP 紀錄，避免長時間運行後 Map 無限成長
  if (hits.size > 1000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= RATE_WINDOW)) hits.delete(key)
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW)
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

const badRequest = (message: string) => createError({ statusCode: 400, statusMessage: 'Bad Request', message })

// 共用同一個 SMTP 連線設定（首次寄信時建立）
let transporter: Transporter | null = null

export default defineEventHandler(async (event) => {
  const body = (await readBody<Record<string, unknown>>(event).catch(() => null)) ?? {}

  // honeypot 有值 → 視為機器人：回傳成功但不寄信，避免對方察覺而改變手法
  if (str(body.website)) return { ok: true }

  const name = str(body.name).replace(/[\r\n]+/g, ' ') // 名字會進信件標題，移除換行避免標頭注入
  const email = str(body.email)
  const topic = str(body.topic) as ContactTopic
  const message = str(body.message)

  if (!name) throw badRequest('Please enter your name.')
  if (name.length > CONTACT_LIMITS.name) throw badRequest(`Name must be under ${CONTACT_LIMITS.name} characters.`)
  if (!EMAIL_RE.test(email) || email.length > CONTACT_LIMITS.email) throw badRequest('Please enter a valid email.')
  if (!CONTACT_TOPICS.includes(topic)) throw badRequest('Please choose a topic.')
  if (!message) throw badRequest('Please enter a message.')
  if (message.length > CONTACT_LIMITS.message) {
    throw badRequest(`Message must be under ${CONTACT_LIMITS.message} characters.`)
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (isRateLimited(ip)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Too many messages. Please try again later.'
    })
  }

  const { mail } = useRuntimeConfig(event)
  if (!mail.user || !mail.pass) {
    console.error('[contact] 寄信設定缺少 NUXT_MAIL_USER / NUXT_MAIL_PASS，請參考 .env.example')
    throw createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: 'Mail service is not configured.'
    })
  }

  transporter ??= nodemailer.createTransport({ service: 'gmail', auth: { user: mail.user, pass: mail.pass } })

  const sentAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
  const rows: [string, string][] = [
    ['Name', name],
    ['Email', email],
    ['Topic', topic],
    ['Sent at', sentAt]
  ]

  try {
    await transporter.sendMail({
      from: { name: 'Portfolio Contact', address: mail.user }, // Gmail 只允許以登入帳號本身寄出
      to: mail.to || mail.user,
      replyTo: { name, address: email },
      subject: `[Portfolio] ${topic} — ${name}`,
      text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${message}`,
      html: `
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:4px 12px 4px 0;color:#888">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`
            )
            .join('')}
        </table>
        <p style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;margin-top:16px">${escapeHtml(message)}</p>
      `
    })
  } catch (err) {
    console.error('[contact] 寄信失敗：', err)
    throw createError({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      message: 'Failed to send. Please email me directly.'
    })
  }

  return { ok: true }
})
