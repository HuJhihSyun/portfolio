<script setup>
  import { ref, onMounted, onUnmounted } from 'vue'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
  import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
  import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
  import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
  import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
  import gsap from 'gsap'

  const canvasRef = ref(null)
  let animationId = null
  let renderer = null
  let handleResize = null
  let helmet = null
  let composer = null

  onMounted(() => {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      antialias: true // 開啟抗鋸齒，畫面更細緻
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio) // 支援高解析度螢幕
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 5

    // 光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    scene.add(ambientLight, directionalLight)

    // 環境貼圖
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()

    new RGBELoader().load('/venice_sunset_1k.hdr', (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture
      scene.environment = envMap
      scene.background = envMap
      texture.dispose()
      pmremGenerator.dispose()
    })

    // 方塊
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.0
    })
    const cube = new THREE.Mesh(geometry, material)
    cube.castShadow = true
    cube.receiveShadow = true
    scene.add(cube)

    // OrbitControls 軌道控制器
    const controls = new OrbitControls(camera, canvasRef.value)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // 地板
    const floorGeometry = new THREE.PlaneGeometry(10, 10)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.5
    floor.receiveShadow = true
    scene.add(floor)

    // EffectComposer
    composer = new EffectComposer(renderer)

    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8, // 強度
      0.3, // 半徑
      0.9 // 閾值
    )
    composer.addPass(bloomPass)

    // onMounted 只寫一次，animate 在裡面定義
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      cube.rotation.y += 0.01
      controls.update()
      composer.render()
    }

    animate()

    // 視窗大小改變時，更新相機和渲染器
    handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    // DamagedHelmet
    const gltfLoader = new GLTFLoader()
    gltfLoader.load('/models/DamagedHelmet/DamagedHelmet.gltf', (gltf) => {
      helmet = gltf.scene

      helmet.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      helmet.position.set(2, 0, 0)
      scene.add(helmet)

      // 待機動畫
      gsap.to(helmet.rotation, {
        y: Math.PI * 2,
        duration: 8,
        repeat: -1,
        ease: 'none'
      })
    })
  })

  onUnmounted(() => {
    cancelAnimationFrame(animationId)
    renderer?.dispose()
    composer?.dispose()
    window.removeEventListener('resize', handleResize)
  })
</script>

<template>
  <canvas ref="canvasRef" />
</template>
