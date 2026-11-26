/**
 * Behance 作品的手動補充設定（/api/gallery/works 會把這裡的內容合併進 Behance 取得的資料）。
 *
 * 為什麼需要：
 *   - Behance 的 RSS 只列最新 12 件作品 → 更早的作品放進 extra
 *   - RSS 的描述遇到中文會變亂碼，Behance 也沒有其他可取得描述的公開管道 → 描述請寫在 overrides 的 caption
 *   - 讚數、觀看數、作品類別都取不到 → 類別預設由標題前綴（【網頁設計】、平面設計- 等）推算，可用 kind 覆寫
 *
 * 類別（kind）格式為「大類 · 細類」，例如 Web · Interactive：
 * Gallery 的 Works 區左欄依大類分組、列出各細類供篩選（沒有「·」時整個字串視為大類）。
 * 目前的類別沿用首頁 WorksBoard 的分類，WorksBoard 沒有的作品依標題推測（註解標示），可自行調整。
 *
 * 修改後重新整理頁面即生效（不必等 API 快取過期）。
 */

export interface WorkOverride {
  title?: string // 覆寫顯示標題（預設：Behance 標題去掉【網頁設計】等前綴與結尾的作者名）
  caption?: string // 作品描述
  kind?: string // 類別：「大類 · 細類」，例如 Web · Interactive、Graphic · EDM
  date?: string // 發佈日期（ISO 8601，例如 2021-07-01）；extra 作品取不到日期，可在此補上以便排序
  hidden?: boolean // true：不顯示此作品
}

// RSS 最新 12 件以外、想一起顯示的較早作品：填作品網址或編號（behance.net/gallery/{編號}/...）
export const extra: string[] = [
  'https://www.behance.net/gallery/129157533', // 萬里蟹線上特展
  'https://www.behance.net/gallery/129019039', // 2020 Global Wellness Challenge 運動電子報 ver.2
  'https://www.behance.net/gallery/122402577', // 2020 Global Wellness Challenge 運動電子報
  'https://www.behance.net/gallery/121244725', // 想像力相談所（網頁端）
  'https://www.behance.net/gallery/119329421', // 2020 Power of Prevention 健康生活提案
  'https://www.behance.net/gallery/114312609' // 國立臺北大學多元專長培力方案招生網
]

// 依作品編號補充或覆寫資料；空字串視為未填
export const overrides: Record<string, WorkOverride> = {
  '158510491': { kind: 'Web · Campaign Site', caption: '' }, // Basf 環境用藥篇互動式網站
  '157699859': { kind: 'Graphic · Print', caption: '' }, // 知名品牌印表機 DM
  '148729665': { kind: 'Graphic · EDM', caption: '' }, // 2019 幸福 x 好孕 FUN 心提案
  '148208039': { kind: 'Web · Campaign Site', caption: '' }, // wellness 健康促進個人化網站（類別為推測，請確認）
  '148205879': { kind: 'Graphic · Event Agenda', caption: '' }, // Take Our Children to Work DM
  '148195493': { kind: 'Graphic · Event EDM', caption: '' }, // Forge 基礎訓練工作坊 & 建築產業趨勢論壇
  '147958027': { kind: 'Graphic · EDM', caption: '' }, // 2019 Well Beyond Event 電子報
  '147424833': { kind: 'Web · Interactive', caption: '' }, // 巴斯夫水稻篇互動式網站
  '144331411': { kind: 'Web · Event Site', caption: '' }, // 2021 Autodesk Converge 創新高峰會（類別為推測，請確認）
  '140207411': { kind: 'Web · Event Site', caption: '' }, // Autodesk Bim Award 數位應用創新獎（類別為推測，請確認）
  '137439655': { kind: 'Web · Interactive', caption: '' }, // 互動計時問答遊戲網站（類別為推測，請確認）
  '132634813': { kind: 'Web · Illustrated Site', caption: '' }, // 伊甸基金會線上畫廊
  '129157533': { kind: 'Web · Online Exhibition', caption: '' }, // 萬里蟹線上特展
  '129019039': { kind: 'Graphic · Campaign Visual', caption: '' }, // 2020 Global Wellness Challenge 運動電子報 ver.2
  '122402577': { kind: 'Graphic · Campaign Visual', caption: '' }, // 2020 Global Wellness Challenge 運動電子報
  '121244725': { kind: 'Web · Responsive', caption: '' }, // 想像力相談所（網頁端）
  '119329421': { kind: 'Graphic · EDM', caption: '' }, // 2020 Power of Prevention 健康生活提案
  '114312609': { kind: 'Web · Responsive', caption: '' } // 國立臺北大學多元專長培力方案招生網
}
