<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import gsap from 'gsap'
  import baseUrl from '~/assets/images/articles/scene-base.webp'
  import personSitUrl from '~/assets/images/articles/scene-person-sit.png'
  import personRailUrl from '~/assets/images/articles/scene-person-rail.png'

  /**
   * ArticlesScene：Articles 頁的背景（做法參考 kprverse Protocol 頁：分層插畫，隨捲動由上往下移動）。
   * 一張直式照片拆成多個「同尺寸、位置對齊」的圖層疊在一起，頁面捲動時整個場景往上移（像鏡頭往下看），
   * 各圖層依深度以不同速度位移（parallax）：越遠的越慢、越近的越快；霧、光束、文字也各自是一層。
   *
   * 為了不搶走文案的焦點：桌機版照片縮成左側一欄（約 46% 視窗寬、略為壓暗），右緣淡入同一張照片的模糊暗化底；
   * 文章列表放在右半部的暗底上（同 Protocol 頁「左側插畫、右側文案」）。行動版照片滿寬並整體壓暗。
   *
   * 圖層位移公式：offsetY = depth × (p − align) × 移動範圍
   *   p     = 捲動進度（0 = 頁首、1 = 頁尾），由父層呼叫 setProgress()
   *   depth = 正值為遠景（比底圖慢）、負值為近景（比底圖快）、0 = 與底圖同步
   *   align = 該層在原圖位置「剛好對齊」的進度（通常設在該層最常被看到的時候）
   *
   * TODO（素材待補，使用者之後用 Photoshop 製作）：
   *   - 目前只有兩個人物是分開的圖層（macOS Vision 去背），而底圖還沒補畫人物後方的背景，
   *     所以人物的 depth 暫為 0（與底圖同步，否則會看到重影）
   *   - 待補：山壁、岩石平台、右上樹葉、欄杆、左下前景葉子各自的圖層，以及補好背景的底圖、更高解析度的原圖
   *   - 素材到了：在 LAYERS 加入新圖層（同尺寸 PNG）並設定 depth / align，人物也改成非 0 的 depth
   */

  // 原圖尺寸（所有圖層同尺寸、位置對齊）
  const IMG_W = 1126
  const IMG_H = 2000

  type ImageLayer = { name: string; src: string; depth: number; align: number }
  const LAYERS: ImageLayer[] = [
    { name: 'base', src: baseUrl, depth: 0, align: 0 },
    // 人物（暫與底圖同步，見上方 TODO）
    { name: 'person-sit', src: personSitUrl, depth: 0, align: 0.42 },
    { name: 'person-rail', src: personRailUrl, depth: 0, align: 1 }
  ]

  const stack = ref<HTMLElement | null>(null)
  const layerEls = ref<HTMLElement[]>([])
  const mistBack = ref<HTMLElement | null>(null)
  const mistFront = ref<HTMLElement | null>(null)
  const rays = ref<HTMLElement | null>(null)
  const backdrop = ref<HTMLElement | null>(null)
  const dust = ref<HTMLCanvasElement | null>(null)

  let progress = 0
  /** 捲動進度 0～1（父層由 ScrollTrigger 平滑後傳入） */
  const setProgress = (p: number) => (progress = gsap.utils.clamp(0, 1, p))

  // 場景尺寸：桌機為左側一欄（寬約 46% 視窗、至少 1.6 個視窗高）；行動版滿寬、至少 1.5 個視窗高（左右裁切）
  let vw = 0
  let vh = 0
  let W = 0
  let H = 0
  let isDesktop = true
  const measure = () => {
    vw = window.innerWidth
    vh = window.innerHeight
    isDesktop = vw >= 768
    if (isDesktop) {
      W = Math.max(vw * 0.46, vh * 1.6 * (IMG_W / IMG_H))
      H = W * (IMG_H / IMG_W)
    } else {
      H = Math.max(vw * (IMG_H / IMG_W), vh * 1.5)
      W = H * (IMG_W / IMG_H)
    }
    if (stack.value) {
      stack.value.style.width = `${W}px`
      stack.value.style.height = `${H}px`
      stack.value.style.setProperty('--stack-w', `${W}px`)
    }
    if (dust.value) {
      const dpr = Math.min(window.devicePixelRatio, 2)
      dust.value.width = vw * dpr
      dust.value.height = vh * dpr
    }
  }

  // ── 每幀：依捲動進度套用場景與各層位移 ──
  let lastY = 0
  let camDelta = 0
  const render = () => {
    if (!stack.value) return
    const rangeY = Math.max(0, H - vh)
    const y = -progress * rangeY
    // 桌機靠左；行動版（左右裁切）由偏左的坐姿人物漸漸移向右下的欄杆人物
    const x = isDesktop ? 0 : gsap.utils.clamp(vw - W, 0, vw / 2 - gsap.utils.interpolate(0.4, 0.72, progress) * W)
    stack.value.style.transform = `translate3d(${x}px, ${y}px, 0)`
    camDelta = y - lastY
    lastY = y
    const offset = (depth: number, align: number) => depth * (progress - align) * rangeY
    LAYERS.forEach((layer, i) => {
      const el = layerEls.value[i]
      if (el && layer.depth) el.style.transform = `translate3d(0, ${offset(layer.depth, layer.align)}px, 0)`
    })
    if (mistBack.value) mistBack.value.style.translate = `0 ${offset(0.1, 0.5)}px`
    if (mistFront.value) mistFront.value.style.translate = `0 ${offset(-0.14, 0.5)}px`
    if (rays.value) rays.value.style.translate = `0 ${offset(0.22, 0)}px`
    if (backdrop.value) backdrop.value.style.translate = `0 ${-progress * vh * 0.15}px`
    drawDust()
  }

  // ── 光中浮塵：畫面座標的粒子，緩慢飄動；捲動時位移得比場景多（像在鏡頭前方）──
  type Mote = { x: number; y: number; r: number; vx: number; vy: number; a: number; tw: number }
  let motes: Mote[] = []
  const seedDust = () => {
    motes = Array.from({ length: 55 }, () => ({
      x: Math.random() * 0.55,
      y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.0001,
      vy: -0.00004 - Math.random() * 0.0001,
      a: 0.12 + Math.random() * 0.4,
      tw: Math.random() * Math.PI * 2
    }))
  }
  let reduceMotion = false
  const drawDust = () => {
    const cv = dust.value
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = cv.width / Math.max(1, vw)
    const spanX = isDesktop ? W / vw : 1 // 只在照片範圍內飄
    ctx.clearRect(0, 0, cv.width, cv.height)
    const t = performance.now() * 0.001
    motes.forEach((m) => {
      if (!reduceMotion) {
        m.x = (m.x + m.vx + 1) % 1
        m.y = (m.y + m.vy + (camDelta * 1.35) / Math.max(1, vh) + 1) % 1
      }
      const alpha = m.a * (0.6 + 0.4 * Math.sin(t * 1.3 + m.tw))
      ctx.beginPath()
      ctx.fillStyle = `rgba(255, 250, 235, ${alpha})`
      ctx.arc(m.x * spanX * vw * dpr, m.y * vh * dpr, m.r * dpr, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  onMounted(() => {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    measure()
    seedDust()
    render()
    window.addEventListener('resize', measure)
    gsap.ticker.add(render)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', measure)
    gsap.ticker.remove(render)
  })

  defineExpose({ setProgress })
</script>

<template>
  <div class="articles-scene pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0b0d0c]" aria-hidden="true">
    <!-- 模糊暗化的同一張照片：填滿照片欄以外的區域（文章列表墊在這層上） -->
    <div ref="backdrop" class="scene-backdrop absolute" :style="{ backgroundImage: `url(${baseUrl})` }"></div>

    <!-- 照片欄（所有圖層同尺寸疊放，整體位移 = 捲動） -->
    <div ref="stack" class="scene-stack absolute left-0 top-0">
      <div :ref="(el) => (layerEls[0] = el as HTMLElement)" class="scene-layer">
        <img :src="LAYERS[0]!.src" alt="" decoding="async" fetchpriority="high" />
      </div>
      <!-- 後方的霧（在人物後面，讓人物更突出） -->
      <div ref="mistBack" class="scene-mist is-back"></div>
      <!-- 其餘圖層（人物等） -->
      <div
        v-for="(layer, i) in LAYERS.slice(1)"
        :key="layer.name"
        :ref="(el) => (layerEls[i + 1] = el as HTMLElement)"
        class="scene-layer"
      >
        <img :src="layer.src" alt="" decoding="async" loading="lazy" />
      </div>
      <!-- 光束與前方的霧 -->
      <div ref="rays" class="scene-rays"></div>
      <div ref="mistFront" class="scene-mist is-front"></div>
    </div>

    <!-- 浮塵（畫面座標） -->
    <canvas ref="dust" class="absolute inset-0 h-full w-full"></canvas>
    <!-- 文字可讀性：上下與四周微微壓暗（行動版整體壓暗更多） -->
    <span class="scene-shade absolute inset-0"></span>
  </div>
</template>

<style scoped>
  .scene-backdrop {
    inset: -10% -10% -25%;
    background-position: center;
    background-size: cover;
    filter: blur(48px) brightness(0.32) saturate(1.15);
    will-change: translate;
  }

  .scene-stack {
    width: 46vw;
    aspect-ratio: 1126 / 2000;
    filter: brightness(0.72) saturate(0.9);
    will-change: transform;

    /* 桌機：右緣淡入模糊底 */
    @media (min-width: 768px) {
      mask-image: linear-gradient(to right, #000 62%, transparent 98%);
    }
  }

  .scene-layer {
    position: absolute;
    inset: 0;
    will-change: transform;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  /* 霧：數團柔和的白色漸層，緩慢左右飄移（以 screen 混合，只會變亮） */
  .scene-mist {
    position: absolute;
    left: -25%;
    width: 150%;
    mix-blend-mode: screen;
    animation: mist-drift 38s ease-in-out infinite alternate;
    will-change: transform;

    &.is-back {
      top: 30%;
      height: 50%;
      opacity: 0.5;
      background:
        radial-gradient(ellipse 28% 18% at 30% 40%, rgb(235 240 235 / 0.45), transparent 70%),
        radial-gradient(ellipse 30% 16% at 70% 55%, rgb(235 240 235 / 0.4), transparent 70%),
        radial-gradient(ellipse 22% 14% at 52% 78%, rgb(240 244 240 / 0.35), transparent 70%);
    }

    &.is-front {
      top: 8%;
      height: 92%;
      opacity: 0.35;
      animation-duration: 26s;
      animation-direction: alternate-reverse;
      background:
        radial-gradient(ellipse 26% 8% at 25% 18%, rgb(245 248 245 / 0.5), transparent 70%),
        radial-gradient(ellipse 24% 6% at 78% 52%, rgb(245 248 245 / 0.35), transparent 70%),
        radial-gradient(ellipse 30% 7% at 40% 90%, rgb(245 248 245 / 0.4), transparent 70%);
    }
  }

  @keyframes mist-drift {
    from {
      transform: translate3d(-6%, 0, 0);
    }
    to {
      transform: translate3d(6%, 0, 0);
    }
  }

  /* 光束：從右上方的光源斜斜灑下（原圖的光從上方偏右透進樹林） */
  .scene-rays {
    position: absolute;
    inset: 0 0 45%;
    mix-blend-mode: screen;
    background: repeating-linear-gradient(
      112deg,
      transparent 0 3%,
      rgb(255 248 225 / 0.07) 3% 6%,
      transparent 6% 8%,
      rgb(255 248 225 / 0.045) 8% 12%
    );
    mask-image: radial-gradient(ellipse 70% 65% at 62% 0%, #000 20%, transparent 75%);
    animation: rays-pulse 9s ease-in-out infinite alternate;
  }

  @keyframes rays-pulse {
    from {
      opacity: 0.55;
    }
    to {
      opacity: 1;
    }
  }

  .scene-shade {
    background:
      linear-gradient(to bottom, rgb(0 0 0 / 0.3), transparent 20%, transparent 75%, rgb(0 0 0 / 0.35)),
      radial-gradient(ellipse at 30% 50%, transparent 50%, rgb(0 0 0 / 0.3));

    @media (max-width: 767px) {
      background: rgb(0 0 0 / 0.5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene-mist,
    .scene-rays {
      animation: none;
    }
  }
</style>
