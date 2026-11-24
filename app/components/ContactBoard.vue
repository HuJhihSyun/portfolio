<script setup lang="ts">
  import { ref, reactive, onBeforeUnmount } from 'vue'
  import type gsap from 'gsap'
  import { CONTACT_LIMITS, CONTACT_TOPICS, type ContactPayload } from '#shared/contact'
  import { CAREER_LINKS, CONTACT, SOCIAL_LINKS } from '#shared/profile'

  /**
   * ContactBoard：第五幕「聯絡 / Footer」（版面參考 kprverse 的 footer）。
   * 上排四欄：終端機訊息 / 求職與作品集 / 社群媒體 / 聯絡方式；中段為聯絡表單（取代原站的巨型字標）；底列為版權與回到頂端。
   * 進場補間由 index.vue 的主 timeline 透過 addTo() 接入；終端機訊息與標題的解碼由 enter() / leave() 觸發。
   */

  type HackyTextExpose = { play: (delay?: number) => void; hide: () => void }

  // 連結與聯絡資訊（與側選單共用，資料在 shared/profile.ts）
  const careerLinks = CAREER_LINKS
  const socialLinks = SOCIAL_LINKS
  const contact = CONTACT

  // 左上終端機訊息（進場時逐行解碼）
  const consoleLines = [
    '// Connection established',
    '> User: Jhih-Syun Hu',
    '> Role: Senior Front-End Engineer',
    `> Channels: ${String(careerLinks.length).padStart(2, '0')} career · ${String(socialLinks.length).padStart(2, '0')} social`,
    'Awaiting your message...'
  ]

  const sectionNo = '04'
  // 標題拆成兩行各自解碼：亂碼期間空白也會被替換成符號，單一字串無法在空白處換行，會衝出欄寬
  const headingLines = ["Let's", 'talk.']
  const headingScrambles = headingLines.map(() => useTextScramble({ duration: 40 }))

  // ── 聯絡表單：送到 server/api/contact.post.ts，由伺服器寄信 ──
  const topics = CONTACT_TOPICS
  const emptyForm = (): ContactPayload => ({ name: '', email: '', topic: topics[0], message: '', website: '' })
  const form = reactive<ContactPayload>(emptyForm())
  const status = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const errorMessage = ref('') // 伺服器回傳的錯誤說明（欄位驗證失敗、送出太頻繁等）

  const onSubmit = async () => {
    if (status.value === 'sending') return
    status.value = 'sending'
    errorMessage.value = ''
    try {
      await $fetch('/api/contact', { method: 'POST', body: { ...form } })
      status.value = 'sent'
      Object.assign(form, emptyForm())
    } catch (err) {
      errorMessage.value = (err as { data?: { message?: string } }).data?.message ?? ''
      status.value = 'error'
    }
  }

  // 複製 Email：按鈕文字短暫切換成 COPIED
  const copied = ref(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact.email)
      copied.value = true
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => (copied.value = false), 1600)
    } catch {
      window.location.href = `mailto:${contact.email}` // 無剪貼簿權限時改開郵件軟體
    }
  }

  // 回到頂端：主 timeline 由 scrub 驅動，捲回頂端時各幕會依序倒播
  const backToTop = () => window.scrollTo({ top: 0 })

  const root = ref<HTMLElement | null>(null)
  const content = ref<HTMLElement | null>(null)
  const colEls: HTMLElement[] = [] // 上排四欄（以函式 ref 依索引收集，非 v-for 的同名 ref 只會保留最後一個）
  const formInner = ref<HTMLElement | null>(null)
  const bottomEl = ref<HTMLElement | null>(null)
  const consoleTexts: HackyTextExpose[] = []

  // 把本幕的捲動補間接到主 timeline 的 at 位置。
  // 內容高於畫面時（行動版、矮螢幕）於進場後整塊上移超出的高度；unitPx 為每 1 單位時間的捲動距離，讓上移與捲動約 1:1
  const addTo = (tl: gsap.core.Timeline, at: number, unitPx = 0) => {
    tl.fromTo(root.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, at)
      // 上排四欄依序浮現
      .fromTo(colEls, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.12 }, at)
      // 表單區：比照原站巨型字標，於遮罩內由下往上升起
      .fromTo(formInner.value, { yPercent: 100 }, { yPercent: 0, duration: 1, ease: 'power3.out' }, at + 0.35)
      .fromTo(bottomEl.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, at + 0.8)

    const overflow = () => Math.max(0, (content.value?.offsetHeight ?? 0) - (root.value?.clientHeight ?? 0))
    const px = overflow()
    if (px > 0 && unitPx > 0) {
      // 進場完成後稍作停留再上移（以函式值量測，搭配 invalidateOnRefresh 在視窗尺寸變更時重新計算）
      tl.fromTo(content.value, { y: 0 }, { y: () => -overflow(), duration: Math.max(1, px / unitPx) }, at + 1.6)
    }
  }

  const enter = () => {
    headingScrambles.forEach((h, i) => h.setText(headingLines[i]!))
    consoleTexts.forEach((t, i) => t.play(200 + i * 220))
  }
  const leave = () => {
    headingScrambles.forEach((h) => h.setText(''))
    consoleTexts.forEach((t) => t.hide())
  }

  onBeforeUnmount(() => clearTimeout(copyTimer))

  defineExpose({ addTo, enter, leave })
</script>

<template>
  <!-- 初始 invisible：在主 timeline 建立前（loading 期間）保持隱藏，避免閃現。
       overflow-clip：表單欄位取得焦點時，瀏覽器不會自行捲動這個容器而打亂 timeline 控制的位置 -->
  <section ref="root" class="invisible absolute inset-0 overflow-clip pointer-events-none">
    <div ref="content" class="flex flex-col md:min-h-full">
      <!-- 上排四欄：行動版改為「標題 | 內容」橫列堆疊，終端機訊息移到最後 -->
      <div class="c-line grid grid-cols-1 border-b-[0.5px] md:grid-cols-4">
        <!-- 終端機訊息 -->
        <div :ref="(el) => (colEls[0] = el as HTMLElement)" class="col is-console">
          <span class="dot-caption"><i></i>Console</span>
          <div class="console" aria-label="Contact console">
            <p v-for="(line, i) in consoleLines" :key="line">
              <AtomsHackyText
                :ref="(el) => (consoleTexts[i] = el as unknown as HackyTextExpose)"
                :text="line"
                hidden
              /><span v-if="i === consoleLines.length - 1" class="cursor" aria-hidden="true">_</span>
            </p>
          </div>
        </div>

        <!-- 求職與作品集 -->
        <div :ref="(el) => (colEls[1] = el as HTMLElement)" class="col">
          <span class="dot-caption"><i></i>Career &amp; Works</span>
          <ul class="links">
            <li v-for="link in careerLinks" :key="link.label">
              <a :href="link.url" target="_blank" rel="noopener noreferrer" class="link-hover">
                {{ link.label }}<span class="arrow" aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
        </div>

        <!-- 社群媒體 -->
        <div :ref="(el) => (colEls[2] = el as HTMLElement)" class="col">
          <span class="dot-caption"><i></i>Social</span>
          <ul class="links">
            <li v-for="link in socialLinks" :key="link.label">
              <a :href="link.url" target="_blank" rel="noopener noreferrer" class="link-hover">
                {{ link.label }}<span class="arrow" aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
        </div>

        <!-- 聯絡方式 -->
        <div :ref="(el) => (colEls[3] = el as HTMLElement)" class="col">
          <span class="dot-caption"><i></i>Get in touch</span>
          <div class="flex flex-col items-start gap-4">
            <dl class="links gap-3!">
              <div>
                <dt class="opacity-50">Email</dt>
                <dd>
                  <a :href="`mailto:${contact.email}`" class="link-hover normal-case">{{ contact.email }}</a>
                </dd>
              </div>
              <div>
                <dt class="opacity-50">Tel</dt>
                <dd>
                  <a :href="contact.telHref" class="link-hover">{{ contact.tel }}</a>
                </dd>
              </div>
            </dl>
            <button type="button" class="btn-bevel pointer-events-auto" @click="copyEmail">
              {{ copied ? 'Copied ✓' : 'Copy Email' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 中段：聯絡表單（取代原站的巨型字標），遮罩內由下往上升起 -->
      <div class="flex-1 overflow-hidden">
        <div ref="formInner" class="grid h-full gap-6 p-4 md:grid-cols-12 md:gap-8 md:p-6">
          <div class="flex flex-col justify-between gap-4 md:col-span-5">
            <div>
              <p class="text-xs tracking-widest opacity-70">[ {{ sectionNo }} ] SEND A MESSAGE</p>
              <!-- 每行預留高度（min-h-[1em]）：解碼前為空字串，避免標題撐高版面造成跳動 -->
              <h2
                class="mt-3 text-[clamp(2rem,12vw,3rem)] uppercase leading-none whitespace-nowrap md:text-6xl lg:text-7xl"
              >
                <!-- 完整原文（視覺隱藏）供搜尋引擎讀取，亂碼動畫標為 aria-hidden（同 Panel） -->
                <span class="sr-only">{{ headingLines.join(' ') }}</span>
                <!-- 行動版兩行並排成一行（字級隨螢幕寬縮放），桌機版各佔一行 -->
                <span
                  v-for="(h, i) in headingScrambles"
                  :key="headingLines[i]"
                  class="inline-block min-h-[1em] md:block"
                  :class="{ 'ml-[0.3em] md:ml-0': i > 0 }"
                  aria-hidden="true"
                  v-html="h.output.value"
                ></span>
              </h2>
            </div>
            <p class="max-w-sm text-xs leading-relaxed opacity-80 md:text-sm">
              Have a role, a project or just want to say hi? Drop a message and I'll get back to you soon.
            </p>
          </div>

          <form class="contact-form pointer-events-auto md:col-span-7" @submit.prevent="onSubmit">
            <!-- 防垃圾訊息的隱藏欄位（honeypot）：移出畫面且不可 tab 到，真人不會填；有值時伺服器會略過不寄 -->
            <input
              v-model="form.website"
              type="text"
              name="website"
              tabindex="-1"
              autocomplete="off"
              aria-hidden="true"
              class="absolute -left-[9999px] h-px w-px opacity-0"
            />
            <div class="grid gap-5 sm:grid-cols-2">
              <label class="field">
                <span class="field-label">01 · Name</span>
                <input
                  v-model="form.name"
                  type="text"
                  name="name"
                  autocomplete="name"
                  :maxlength="CONTACT_LIMITS.name"
                  required
                  placeholder="Your name"
                />
              </label>
              <label class="field">
                <span class="field-label">02 · Email</span>
                <input
                  v-model="form.email"
                  type="email"
                  name="email"
                  autocomplete="email"
                  :maxlength="CONTACT_LIMITS.email"
                  required
                  placeholder="you@example.com"
                />
              </label>
            </div>

            <fieldset class="field">
              <legend class="field-label">03 · Topic</legend>
              <div class="mt-2 flex flex-wrap gap-2">
                <label v-for="topic in topics" :key="topic" class="chip">
                  <input v-model="form.topic" type="radio" name="topic" :value="topic" class="sr-only" />
                  <span>{{ topic }}</span>
                </label>
              </div>
            </fieldset>

            <label class="field">
              <span class="field-label">04 · Message</span>
              <textarea
                v-model="form.message"
                name="message"
                rows="3"
                :maxlength="CONTACT_LIMITS.message"
                required
                placeholder="Tell me about your project or role..."
              ></textarea>
            </label>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-[10px] tracking-widest uppercase opacity-70" aria-live="polite">
                <template v-if="status === 'sending'">Transmitting...</template>
                <template v-else-if="status === 'sent'">Message sent — talk soon.</template>
                <template v-else-if="status === 'error'">{{
                  errorMessage || 'Something went wrong. Please email me directly.'
                }}</template>
                <template v-else>All fields are required.</template>
              </p>
              <button type="submit" class="btn-bevel is-solid" :disabled="status === 'sending'">
                {{ status === 'sending' ? 'Sending...' : 'Send Message →' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 底列：版權 / 技術標示 / 回到頂端 -->
      <div
        ref="bottomEl"
        class="c-line flex h-10 shrink-0 items-center justify-between border-t-[0.5px] px-4 text-[10px] tracking-widest uppercase md:px-6"
      >
        <span class="opacity-60">© 2026 Jhih-Syun Hu</span>
        <span class="hidden opacity-60 md:inline">Designed &amp; Built with Nuxt · GSAP</span>
        <button type="button" class="link-hover uppercase" @click="backToTop">Back to top ↑</button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
  /* 分隔線與 Panel 共用主題變數（scoped 樣式不會繼承 Panel 的 .p-line） */
  .c-line,
  .col {
    border-color: var(--panel-line, rgb(255 255 255 / 0.5));
  }

  /* 上排每欄：桌機版上下分置（標題在上、內容在下），行動版為左標題 + 右內容的橫列 */
  .col {
    display: flex;
    padding: 16px;
    border-bottom-width: 0.5px;
    text-transform: uppercase;

    gap: 12px;

    /* 行動版標題欄寬：讓右側內容（最長的 CakeResume Portfolio）維持單行 */
    > .dot-caption {
      width: 92px;
      flex-shrink: 0;
    }

    /* 行動版：終端機訊息移到最後，且不畫底線（外層已有） */
    &.is-console {
      @media (max-width: 767px) {
        order: 99;
        border-bottom-width: 0;
      }
    }

    @media (min-width: 768px) {
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
      min-height: 184px;
      padding: 24px;
      border-bottom-width: 0;
      border-left-width: 0.5px;

      &:first-child {
        border-left-width: 0;
      }

      > .dot-caption {
        width: auto;
      }
    }
  }

  /* 小方點 + 標題（同側選單） */
  .dot-caption {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    font-size: 10px;
    letter-spacing: 0.08em;
    white-space: nowrap;

    i {
      flex-shrink: 0;
      width: 4px;
      height: 4px;
      background: currentColor;
    }
  }

  .links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    font-size: 11px;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  /* 終端機訊息：小字半透明 + 閃爍游標 */
  .console {
    font-size: 10px;
    line-height: 1.5;
    letter-spacing: 0.02em;
    opacity: 0.6;
    min-width: 0; /* 欄寬不足時自動換行，不被裁切 */
  }

  .cursor {
    margin-left: 2px;
    animation: blink 1s steps(1) infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  /* 連結：hover 時底色由左往右刷入、文字反色（顏色取自主題變數，配色補間時同步） */
  .link-hover {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 2px;
    pointer-events: auto;
    isolation: isolate; /* 讓 z-index:-1 的底色留在連結內，不被外層背景蓋住 */

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: var(--panel-fg, #fff);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s cubic-bezier(0.7, 0, 0.3, 1);
    }

    &:hover,
    &:focus-visible {
      outline: none;
      color: var(--panel-bg, #000);

      &::before {
        transform: scaleX(1);
      }
    }
  }

  .arrow {
    font-size: 9px;
    opacity: 0.7;
  }

  /* 切角按鈕（右下斜切，同站內 My Portfolio 標籤）：外框版 / 實心版 */
  .btn-bevel {
    --bevel: 10px;
    position: relative;
    padding: 10px 22px 10px 14px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--bevel)), calc(100% - var(--bevel)) 100%, 0 100%);
    background: color-mix(in srgb, var(--panel-fg, #fff) 12%, transparent);
    transition:
      background 0.3s,
      color 0.3s;

    &:hover,
    &:focus-visible {
      outline: none;
      background: var(--panel-fg, #fff);
      color: var(--panel-bg, #000);
    }

    &.is-solid {
      background: var(--panel-fg, #fff);
      color: var(--panel-bg, #000);
      font-weight: 700;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--panel-fg, #fff) 75%, transparent);
      }
    }

    &:disabled {
      cursor: wait;
      opacity: 0.6;
    }
  }

  /* 表單：底線輸入框 + 小標籤（HUD 風格） */
  .contact-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    border: 0;
    padding: 0;
    margin: 0;
  }

  .field-label {
    padding: 0;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.7;
  }

  .field input,
  .field textarea {
    width: 100%;
    padding: 6px 0;
    font-size: 14px;
    color: inherit;
    background: transparent;
    border-bottom: 0.5px solid var(--panel-line, rgb(255 255 255 / 0.5));
    border-radius: 0;
    outline: none;
    transition: border-color 0.3s;

    &::placeholder {
      color: inherit;
      opacity: 0.35;
    }

    &:focus {
      border-bottom-color: var(--panel-fg, #fff);
    }
  }

  .field textarea {
    resize: none;
    line-height: 1.5;
  }

  /* 主題單選：方框標籤，選中時反白 */
  .chip span {
    display: inline-block;
    padding: 6px 10px;
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border: 0.5px solid var(--panel-line, rgb(255 255 255 / 0.5));
    cursor: pointer;
    transition:
      background 0.3s,
      color 0.3s,
      border-color 0.3s;
  }

  .chip:hover span {
    border-color: var(--panel-fg, #fff);
  }

  .chip input:checked + span {
    background: var(--panel-fg, #fff);
    color: var(--panel-bg, #000);
    border-color: var(--panel-fg, #fff);
  }

  .chip input:focus-visible + span {
    outline: 1px solid var(--panel-fg, #fff);
    outline-offset: 2px;
  }

  :deep(.scramble-dud) {
    opacity: 0.7;
  }

  @media (prefers-reduced-motion: reduce) {
    .cursor {
      animation: none;
    }
  }
</style>
