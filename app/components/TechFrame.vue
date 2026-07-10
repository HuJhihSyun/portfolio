<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, useId } from 'vue'

  /**
   * TechFrame：科技感 / 未來感切角外框
   * 以「斜切角(bevel)、圓角(round)、缺角(notch)、直角(square)」四種角型自由組合，
   * 做出複雜不規則的外形。切角大小為固定像素、不隨比例縮放，且以 ResizeObserver
   * 量測容器實際尺寸動態生成 SVG path，因此任何比例的圖片都能無痛包裹、外形自適應。
   *
   * 切角尺寸(size/depth/radius/bevelSize)可用 px 數字或百分比字串('20%')；百分比會依容器對應邊
   * 換算，適合響應式版面。
   *
   * 用法：
   *   <TechFrame class="w-full h-full"><img src="..." /></TechFrame>
   * slot 內的圖片會自動填滿並依外形裁切，框線用同一條 path 描邊（stroke 繼承 currentColor）。
   */
  type CornerType = 'round' | 'bevel' | 'notch' | 'square'
  // 長度值：數字(px) 或字串。字串支援 '24'、'24px' 與百分比 '20%'（響應式，依所沿的邊換算）
  type Len = number | string
  interface Corner {
    type: CornerType
    size?: Len // round 半徑 / bevel 斜邊長 / notch 長邊長度；未給則 round·notch 用 props.size、bevel 用 props.bevelSize
    depth?: Len // notch 專用：往內凹的深度（短邊）；與長邊不同 → 長方形凹槽
    radius?: Len // notch 專用：凹槽四個轉角的圓角半徑
    orientation?: 'horizontal' | 'vertical' // notch 專用：長邊方向，橫式(沿水平邊) / 直式(沿垂直邊)
  }

  const props = withDefaults(
    defineProps<{
      topLeft?: Corner
      topRight?: Corner
      bottomRight?: Corner
      bottomLeft?: Corner
      size?: Len // round / notch 的預設切角大小(px 或 %)
      bevelSize?: Len // bevel 的預設斜邊長(px 或 %)，通常比 size 大一些
      stroke?: string // 框線顏色，預設繼承文字色(currentColor)，會跟著主題白→黑
      strokeWidth?: number // 框線粗細(px)
      fill?: string // 外形填色，預設 none（僅描邊）
    }>(),
    {
      topLeft: () => ({ type: 'round' }),
      topRight: () => ({ type: 'bevel' }),
      bottomRight: () => ({ type: 'round' }),
      bottomLeft: () => ({ type: 'notch' }),
      size: 16,
      bevelSize: 30,
      stroke: 'currentColor',
      strokeWidth: 1.5,
      fill: 'none'
    }
  )

  const uid = `tech-frame-${useId()}` // clipPath 專屬 id，避免多實例互相干擾（SSR 穩定）
  const clipUrl = computed(() => `url(#${uid})`)

  const root = ref<HTMLElement | null>(null)
  const w = ref(0)
  const h = ref(0)

  let ro: ResizeObserver | null = null
  onMounted(() => {
    ro = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      w.value = box.width
      h.value = box.height
    })
    ro.observe(root.value!)
  })
  onBeforeUnmount(() => ro?.disconnect())

  // 一個外形頂點：座標 + 圓角半徑（r=0 為尖角）
  interface Vertex {
    x: number
    y: number
    r: number
  }

  // 四個角合併後的設定
  const corners = computed(() => ({
    tl: props.topLeft,
    tr: props.topRight,
    br: props.bottomRight,
    bl: props.bottomLeft
  }))

  // 把長度值解析成像素：數字直接用；'20%' 依 basis(所沿的邊長) 換算；'20px'/'20' 當像素
  const resolveLen = (v: Len | undefined, basis: number, fallback: number): number => {
    if (v === undefined || v === null) return fallback
    if (typeof v === 'number') return v
    const t = v.trim()
    if (t.endsWith('%')) return (parseFloat(t) / 100) * basis
    return parseFloat(t) // '20px' 或 '20'
  }

  /**
   * 產生「某個角」貢獻的頂點串（依順時針走訪順序）。
   * pos 提供角點座標(cx,cy)、水平/垂直邊延伸方向(hx,vy)、以及此角是「先走到垂直邊還是水平邊」。
   * fw,fh 為容器寬高，供百分比換算：圓角/斜切以短邊為基準，notch 長邊/深各以所沿的邊為基準。
   */
  const cornerVertices = (
    conf: Corner,
    cx: number,
    cy: number,
    hx: number,
    vy: number,
    arriveVertical: boolean,
    limit: number,
    fw: number,
    fh: number
  ): Vertex[] => {
    const short = Math.min(fw, fh)
    if (conf.type === 'square') return [{ x: cx, y: cy, r: 0 }]

    if (conf.type === 'round') {
      // 圓角半徑：百分比相對容器短邊
      const s = Math.min(resolveLen(conf.size ?? props.size, short, 16), limit)
      return [{ x: cx, y: cy, r: s }]
    }

    if (conf.type === 'bevel') {
      // bevel 未指定 size 時用較大的 props.bevelSize；百分比相對容器短邊（維持等腰 45° 斜切）
      const s = Math.min(resolveLen(conf.size ?? props.bevelSize, short, 30), limit)
      const vPoint = { x: cx, y: cy + vy * s } // 垂直邊上的點
      const hPoint = { x: cx + hx * s, y: cy } // 水平邊上的點
      const a = arriveVertical ? vPoint : hPoint // 依走訪順序：先垂直邊點或先水平邊點
      const b = arriveVertical ? hPoint : vPoint
      return [
        { ...a, r: 0 },
        { ...b, r: 0 }
      ]
    }

    // notch：圓角長方形凹槽。長邊 = size、短邊(深) = depth；orientation 決定長邊沿哪條邊
    // 百分比基準：長邊沿哪條邊就相對那條邊，深沿另一條邊 → 響應式時各軸獨立縮放
    const vertical = conf.orientation === 'vertical'
    const longBasis = vertical ? fh : fw // 長邊所沿的邊長
    const depthBasis = vertical ? fw : fh // 深所沿的邊長
    const long = resolveLen(conf.size ?? props.size, longBasis, 16)
    const depth = resolveLen(conf.depth, depthBasis, long * 0.6)
    const extentH = Math.min(vertical ? depth : long, limit) // 沿水平邊的延伸
    const extentV = Math.min(vertical ? long : depth, limit) // 沿垂直邊的延伸
    const minExtent = Math.min(extentH, extentV)
    const nr = Math.max(0, Math.min(resolveLen(conf.radius, minExtent, minExtent * 0.4), extentH / 2, extentV / 2))

    const vMouth = { x: cx, y: cy + vy * extentV, r: nr } // 垂直邊上的槽口
    const inner = { x: cx + hx * extentH, y: cy + vy * extentV, r: nr } // 槽底內凹角
    const hMouth = { x: cx + hx * extentH, y: cy, r: nr } // 水平邊上的槽口

    return arriveVertical ? [vMouth, inner, hMouth] : [hMouth, inner, vMouth]
  }

  /** 把「帶圓角的頂點串」轉成封閉 SVG path，弧線方向由相鄰邊的外積自動判斷（凸/凹皆正確）。 */
  const roundedPath = (verts: Vertex[]): string => {
    const n = verts.length
    const f = (v: number) => v.toFixed(2)
    const nodes: string[] = []

    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n]
      const cur = verts[i]
      const next = verts[(i + 1) % n]

      const u1x = cur.x - prev.x
      const u1y = cur.y - prev.y
      const u2x = next.x - cur.x
      const u2y = next.y - cur.y
      const l1 = Math.hypot(u1x, u1y) || 1
      const l2 = Math.hypot(u2x, u2y) || 1
      const a1x = u1x / l1
      const a1y = u1y / l1
      const a2x = u2x / l2
      const a2y = u2y / l2

      const turn = Math.acos(Math.max(-1, Math.min(1, a1x * a2x + a1y * a2y))) // 轉角(0=直線)
      if (cur.r <= 0 || turn < 1e-3) {
        nodes.push(`${i === 0 ? 'M' : 'L'} ${f(cur.x)} ${f(cur.y)}`)
        continue
      }

      // 90°→切線長=r；一般角度 t = r * tan(turn/2)，並夾住不超過相鄰線段一半
      let t = cur.r * Math.tan(turn / 2)
      t = Math.min(t, l1 / 2, l2 / 2)
      const r = t / Math.tan(turn / 2)

      const t1x = cur.x - a1x * t
      const t1y = cur.y - a1y * t
      const t2x = cur.x + a2x * t
      const t2y = cur.y + a2y * t
      const sweep = a1x * a2y - a1y * a2x > 0 ? 1 : 0 // 外積 >0 為順時針弧(凸角)

      nodes.push(`${i === 0 ? 'M' : 'L'} ${f(t1x)} ${f(t1y)}`)
      nodes.push(`A ${f(r)} ${f(r)} 0 0 ${sweep} ${f(t2x)} ${f(t2y)}`)
    }

    return nodes.join(' ') + ' Z'
  }

  // 依實際像素尺寸生成外形 path（順時針）。inset 讓框線 stroke 不被 SVG 邊界裁掉。
  const d = computed(() => {
    const width = w.value
    const height = h.value
    if (width <= 0 || height <= 0) return ''

    const inset = props.strokeWidth / 2
    const x0 = inset
    const y0 = inset
    const x1 = width - inset
    const y1 = height - inset
    const limit = Math.min(x1 - x0, y1 - y0) / 2 // 單邊最多吃掉一半，避免外形自我交錯

    const c = corners.value
    // 順時針：左上 → 右上 → 右下 → 左下；hx/vy 為該角兩條邊自角點延伸的方向
    const verts: Vertex[] = [
      ...cornerVertices(c.tl, x0, y0, +1, +1, true, limit, width, height), // 左上：先走垂直(左)邊
      ...cornerVertices(c.tr, x1, y0, -1, +1, false, limit, width, height), // 右上：先走水平(上)邊
      ...cornerVertices(c.br, x1, y1, -1, -1, true, limit, width, height), // 右下：先走垂直(右)邊
      ...cornerVertices(c.bl, x0, y1, +1, -1, false, limit, width, height) // 左下：先走水平(下)邊
    ]

    return roundedPath(verts)
  })
</script>

<template>
  <div ref="root" class="tech-frame">
    <!-- 圖片層：依外形 path 裁切 -->
    <div class="tech-frame__clip" :style="{ clipPath: clipUrl }">
      <slot />
    </div>

    <!-- 外形定義 + 框線描邊（同一條 path） -->
    <svg class="tech-frame__svg" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath :id="uid" clipPathUnits="userSpaceOnUse">
          <path :d="d" />
        </clipPath>
      </defs>
      <path v-if="d" :d="d" :fill="fill" :stroke="stroke" :stroke-width="strokeWidth" vector-effect="non-scaling-stroke" />
    </svg>
  </div>
</template>

<style scoped>
  .tech-frame {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
  }

  .tech-frame__clip {
    width: 100%;
    height: 100%;
  }

  /* slot 內的圖片自動填滿並保持覆蓋（任何比例都無痛包裹） */
  .tech-frame__clip :deep(img),
  .tech-frame__clip :deep(video) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* 框線疊在圖片上方，不攔截滑鼠事件 */
  .tech-frame__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }
</style>
