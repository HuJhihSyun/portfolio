/**
 * 輕量的程式碼上色（不另外安裝套件）：涵蓋教學文章常用的 TS / JS / Vue / HTML / CSS / Bash / JSON。
 * 只做一次掃描、分成幾類 token（註解、字串、標籤、數字、函式、關鍵字），輸出含 <span class="tk-*"> 的 HTML。
 * 原始碼會先跳脫 < > &，可安全用 v-html 顯示。
 */

const KEYWORDS = new Set(
  (
    'const let var function return if else for while do of in new class extends import from export default ' +
    'async await try catch finally throw typeof instanceof interface type implements public private protected ' +
    'readonly as void null undefined true false this break continue switch case delete yield static enum declare'
  ).split(' ')
)

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 依序：註解｜字串｜HTML 標籤名｜數字｜函式名稱（後面接括號）｜一般識別字
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(<\/?[A-Za-z][\w-]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$-]*)/g

const span = (cls: string, text: string) => `<span class="tk-${cls}">${escape(text)}</span>`

export const highlight = (code: string, language = 'ts') => {
  // Bash 的註解是 #；其他語言保留 #（例如 CSS 色碼、私有欄位）
  if (language === 'bash') {
    return code
      .split('\n')
      .map((line) => {
        const i = line.indexOf('#')
        return i >= 0 ? escape(line.slice(0, i)) + span('comment', line.slice(i)) : escape(line)
      })
      .join('\n')
  }
  if (language === 'text') return escape(code)

  let out = ''
  let last = 0
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0
    out += escape(code.slice(last, index))
    last = index + match[0].length
    const [, comment, string, tag, number, fn, word] = match
    if (comment) out += span('comment', comment)
    else if (string) out += span('string', string)
    else if (tag) out += span('tag', tag)
    else if (number) out += span('number', number)
    else if (fn) out += KEYWORDS.has(fn) ? span('keyword', fn) : span('fn', fn)
    else if (word) out += KEYWORDS.has(word) ? span('keyword', word) : escape(word)
  }
  return out + escape(code.slice(last))
}
