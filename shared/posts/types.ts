/**
 * 文章資料格式。
 * 內文採用 Editor.js 的輸出格式（OutputData：{ time, version, blocks: [{ id, type, data }] }），
 * 這是目前區塊式編輯器 / Headless CMS 常見的 JSON 結構：每個段落是一個區塊，前台依 type 渲染對應元件。
 * 之後接上後台（Editor.js、Notion、Strapi、Sanity 等）時，只要轉成同樣的結構即可，前台不用改。
 *
 * 區塊類型對應 Editor.js 官方 / 常用外掛的 data 欄位；demo 為本站自訂的「成果呈現」區塊。
 */

export interface HeaderBlock {
  type: 'header'
  data: { text: string; level: 2 | 3 | 4 }
}

export interface ParagraphBlock {
  type: 'paragraph'
  data: { text: string } // 可含行內 HTML：<b>、<i>、<code>、<a>、<mark>
}

export interface ListBlock {
  type: 'list'
  data: { style: 'ordered' | 'unordered'; items: string[] } // 項目可含行內 HTML
}

export interface CodeBlock {
  type: 'code'
  data: {
    code: string
    language: 'ts' | 'js' | 'vue' | 'html' | 'css' | 'bash' | 'json' | 'text'
    filename?: string // 顯示在程式碼區塊上方的檔名
  }
}

export interface QuoteBlock {
  type: 'quote'
  data: { text: string; caption?: string }
}

export interface WarningBlock {
  type: 'warning' // Editor.js 的 Warning 外掛：提示框
  data: { title: string; message: string; tone?: 'note' | 'tip' | 'warning' }
}

export interface TableBlock {
  type: 'table'
  data: { withHeadings: boolean; content: string[][] }
}

export interface ImageBlock {
  type: 'image'
  data: { file: { url: string; width?: number; height?: number }; caption?: string; alt?: string }
}

export interface DelimiterBlock {
  type: 'delimiter'
  data: Record<string, never>
}

export interface DemoBlock {
  type: 'demo' // 自訂：嵌入可操作的成果（component 對應 app/components/article/demo/ 裡的元件）
  data: { component: 'text-scramble-basic' | 'text-scramble-hover' | 'text-scramble-playground'; caption?: string }
}

export type Block = { id: string } & (
  | HeaderBlock
  | ParagraphBlock
  | ListBlock
  | CodeBlock
  | QuoteBlock
  | WarningBlock
  | TableBlock
  | ImageBlock
  | DelimiterBlock
  | DemoBlock
)

/** Editor.js 的輸出格式 */
export interface OutputData {
  time: number // 最後編輯時間（Unix 毫秒）
  version: string // Editor.js 版本
  blocks: Block[]
}

export interface Post {
  id: string // 文章編號（固定不變，之後接資料庫時當主鍵）
  slug: string // 網址：/articles/{slug}
  title: string
  excerpt: string // 摘要：列表、SEO 描述、分享卡片
  category: 'frontend' | 'motion' | 'design' | 'notes' // 對應 Articles 頁的分類（shared/articles.ts）
  tags: string[]
  author: { name: string; url?: string }
  publishedAt: string // ISO 8601
  updatedAt?: string
  cover?: { src: string; alt: string }
  status: 'published' | 'draft'
  content: OutputData
}
