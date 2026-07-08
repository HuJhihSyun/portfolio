interface TiltOptions {
  // 最大傾斜角度（度）
  max?: number
  // 景深，越小透視越誇張
  perspective?: number
  // 平滑係數（0~1，越小越滑順但越慢跟上）
  ease?: number
  // 圖片本身的放大倍率，避免傾斜時露出邊緣
  scale?: number
}

/**
 * 3D Tilt / Parallax Tilt 效果。
 * 依滑鼠在畫面上的位置，讓元素往對應方向立體傾斜（純 CSS 3D transform，不需 three.js）。
 */
export function useTilt(options: TiltOptions = {}) {
  const max = options.max ?? 12
  const perspective = options.perspective ?? 1000
  const ease = options.ease ?? 0.08
  const scale = options.scale ?? 1.06

  // 目前套用到 style 上的 transform 字串
  const tiltStyle = ref('')

  // 目標角度（滑鼠決定）與目前角度（每幀補間逼近目標）
  let targetX = 0
  let targetY = 0
  let currentX = 0
  let currentY = 0
  let frameId = 0
  let enabled = true

  function onMouseMove(e: MouseEvent) {
    // 將滑鼠位置換算成 -1 ~ 1（畫面中心為 0）
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    // 滑鼠往右 → 繞 Y 軸右傾；往下 → 繞 X 軸前傾
    targetY = nx * max
    targetX = -ny * max
  }

  function render() {
    // 線性補間，讓角度平滑追上目標
    currentX += (targetX - currentX) * ease
    currentY += (targetY - currentY) * ease
    tiltStyle.value = `perspective(${perspective}px) rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg) scale(${scale})`
    frameId = requestAnimationFrame(render)
  }

  onMounted(() => {
    // 尊重「減少動態」偏好設定
    enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!enabled) return
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    render()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMouseMove)
    cancelAnimationFrame(frameId)
  })

  return { tiltStyle }
}
