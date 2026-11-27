import type { Block, Post } from './types'
import { textScramblePost } from './text-scramble'

export type * from './types'

/**
 * 文章清單（目前沒有後台，先以程式檔維護：每篇一個檔案，於此註冊）。
 * 新增文章：在 shared/posts/ 新增一個檔案（格式見 types.ts），再加進 POSTS。
 */
export const POSTS: Post[] = [textScramblePost]

const published = () => POSTS.filter((post) => post.status === 'published')

export const getPost = (slug: string) => published().find((post) => post.slug === slug)

// 純文字（去掉行內 HTML）
const plain = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ')

const blockText = (block: Block): string => {
  switch (block.type) {
    case 'header':
    case 'paragraph':
      return plain(block.data.text)
    case 'list':
      return block.data.items.map(plain).join(' ')
    case 'quote':
      return plain(block.data.text)
    case 'warning':
      return `${plain(block.data.title)} ${plain(block.data.message)}`
    case 'table':
      return block.data.content.flat().map(plain).join(' ')
    default:
      return ''
  }
}

/**
 * 閱讀時間（分鐘）：中文約每分鐘 400 字、英文約 200 字；程式碼以每分鐘 25 行計，成果區塊各加 0.5 分鐘
 */
export const readingMinutes = (post: Post) => {
  let minutes = 0
  for (const block of post.content.blocks) {
    if (block.type === 'code') minutes += block.data.code.split('\n').length / 25
    else if (block.type === 'demo') minutes += 0.5
    else {
      const text = blockText(block)
      // 中日韓漢字（Unicode U+3400～U+9FFF）
      const cjk = (text.match(/[㐀-鿿]/g) ?? []).length
      const words = text.replace(/[㐀-鿿]/g, ' ').split(/\s+/).filter(Boolean).length
      minutes += cjk / 400 + words / 200
    }
  }
  return Math.max(1, Math.round(minutes))
}

/** 文章的二級標題（目錄用）：id 即錨點 */
export const postOutline = (post: Post) =>
  post.content.blocks
    .filter((block) => block.type === 'header' && block.data.level === 2)
    .map((block) => ({ id: block.id, text: plain((block as Extract<Block, { type: 'header' }>).data.text) }))

/** 列表用的摘要資料 */
export const postSummaries = () =>
  published().map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    publishedAt: post.publishedAt,
    readTime: `${readingMinutes(post)} min read`,
    link: `/articles/${post.slug}`
  }))

/** 日期格式：2026.11.27 */
export const formatDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')
