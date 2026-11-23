// 聯絡表單的共用設定：前端（ContactBoard）與 API（server/api/contact.post.ts）共用，確保兩邊的選項與驗證規則一致

export const CONTACT_TOPICS = ['Job Opportunity', 'Freelance', 'Collaboration', 'Just Say Hi'] as const

export type ContactTopic = (typeof CONTACT_TOPICS)[number]

// 各欄位長度上限（前端 maxlength 與後端驗證共用）
export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  message: 5000
} as const

export interface ContactPayload {
  name: string
  email: string
  topic: ContactTopic
  message: string
  website?: string // 防垃圾訊息的隱藏欄位（honeypot）：真人看不到、不會填，機器人常會自動填入
}
