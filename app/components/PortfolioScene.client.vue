<template>
  <canvas ref="canvasRef" class="three-canvas" />
</template>

<script setup>
  import * as THREE from 'three'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

  gsap.registerPlugin(ScrollTrigger)

  const canvasRef = ref(null)
  let animationId = null
  let renderer = null
  let handleResize = null

  onMounted(async () => {
    await nextTick() // 等 DOM 真正掛載完

    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true,
      alpha: true
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 0, 5)

    // 環境貼圖
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()

    new RGBELoader().load('/venice_sunset_1k.hdr', (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture
      scene.environment = envMap
      texture.dispose()
      pmremGenerator.dispose()
    })

    // 霓虹網格地板
    const gridHelper = new THREE.GridHelper(50, 50, 0x00fff0, 0x00fff0)
    gridHelper.position.y = -2
    gridHelper.material.opacity = 0.3
    gridHelper.material.transparent = true
    scene.add(gridHelper)

    // 相機改成低角度，像在街道上往前看
    camera.position.set(0, 1, 8)
    camera.lookAt(0, 0, 0)

    // 加一個發光的核心物件（八面體，像能量核心）
    const coreGeometry = new THREE.OctahedronGeometry(0.8)
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x00fff0,
      emissive: 0x00fff0,
      emissiveIntensity: 0.5,
      metalness: 1.0,
      roughness: 0.0
    })
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    scene.add(core)

    // 光源改成霓虹色
    const ambientLight = new THREE.AmbientLight(0x000022, 1)
    const neonLight1 = new THREE.PointLight(0x00fff0, 2, 20) // 青色霓虹
    neonLight1.position.set(3, 3, 3)
    const neonLight2 = new THREE.PointLight(0xff2d78, 2, 20) // 粉色霓虹
    neonLight2.position.set(-3, 2, -3)
    scene.add(ambientLight, neonLight1, neonLight2)

    // 粒子系統
    const particlesGeometry = new THREE.BufferGeometry()
    const count = 3000
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 30
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const particlesMaterial = new THREE.PointsMaterial({
      color: 0x00fff0, // 改成霓虹青
      size: 0.03,
      sizeAttenuation: true
    })

    const particles = new THREE.Points(particlesGeometry, particlesMaterial)
    scene.add(particles)

    // ScrollTrigger 控制相機位置
    // 每個 section 對應相機移動到不同位置
    const sections = [
      { trigger: '.section-about', camera: { x: 2, y: 0, z: 4 } },
      { trigger: '.section-skills', camera: { x: -2, y: 1, z: 4 } },
      { trigger: '.section-projects', camera: { x: 0, y: -1, z: 3 } },
      { trigger: '.section-contact', camera: { x: 0, y: 0, z: 6 } }
    ]

    sections.forEach(({ trigger, camera: camPos }) => {
      gsap.to(camera.position, {
        ...camPos,
        ease: 'none', // scrub 模式下 ease 要設成 none
        scrollTrigger: {
          trigger,
          start: 'top center',
          end: 'bottom center',
          scrub: 1.5 // 數字是「跟上」的延遲秒數，越大越滑順
        }
      })
    })

    handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      core.rotation.x += 0.005
      core.rotation.y += 0.008
      particles.rotation.y += 0.0003
      renderer.render(scene, camera)
    }
    animate()
  })

  onUnmounted(() => {
    cancelAnimationFrame(animationId)
    renderer?.dispose()
    window.removeEventListener('resize', handleResize)
    ScrollTrigger.killAll() // 清理所有 ScrollTrigger 實例
  })
</script>

<style scoped>
  .three-canvas {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 0;
    display: block;
  }
</style>
