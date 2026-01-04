<template>
  <div class="container">
    <div ref="containerRef" class="three-container"></div>
    <div ref="statsRef" class="stats"></div>
    <div v-if="loading" class="loading">加载中...</div>
    <div class="controls">
      <button class="btn" @click="toggleDayNight">🌓 切换昼夜</button>
      <button class="btn" @click="resetCamera">📷 重置视角</button>
      <button class="btn" @click="toggleWireframe">🔲 线框模式</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const containerRef = ref(null)
const statsRef = ref(null)
const loading = ref(true)

let scene, camera, renderer, controls, stats
let Stats
let isDayTime = ref(true)
let wireframeMode = ref(false)
const buildings = []
const lights = []

// 创建地面
function createGround() {
  const groundGeometry = new THREE.PlaneGeometry(200, 200)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5d23,
    roughness: 0.8,
    metalness: 0.2
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  scene.add(ground)

  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x666666)
  gridHelper.position.y = 0.01
  scene.add(gridHelper)
}

// 创建建筑物
function createBuilding(x, z, width, depth, height, color) {
  const group = new THREE.Group()

  // 主体
  const geometry = new THREE.BoxGeometry(width, height, depth)
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3
  })
  const building = new THREE.Mesh(geometry, material)
  building.position.y = height / 2
  building.castShadow = true
  building.receiveShadow = true
  group.add(building)

  // 添加窗户纹理
  const windowGeometry = new THREE.PlaneGeometry(width * 0.8, height * 0.6)
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    emissive: isDayTime.value ? 0x000000 : 0xffffaa,
    emissiveIntensity: isDayTime.value ? 0 : 0.5,
    transparent: true,
    opacity: 0.8
  })
  
  const windowCount = Math.floor(height / 5)
  for (let i = 0; i < windowCount; i++) {
    const window = new THREE.Mesh(windowGeometry, windowMaterial.clone())
    window.position.set(0, (i - windowCount / 2) * 5 + 2, depth / 2 + 0.1)
    group.add(window)
  }

  // 屋顶
  const roofGeometry = new THREE.ConeGeometry(width * 0.7, height * 0.2, 4)
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    roughness: 0.9
  })
  const roof = new THREE.Mesh(roofGeometry, roofMaterial)
  roof.position.y = height + height * 0.1
  roof.castShadow = true
  group.add(roof)

  group.position.set(x, 0, z)
  return group
}

// 创建多个建筑物
function createBuildings() {
  const buildingConfigs = [
    { x: -30, z: -20, width: 15, depth: 15, height: 25, color: 0x8b9dc3 },
    { x: 30, z: -20, width: 18, depth: 18, height: 30, color: 0xa8c0d0 },
    { x: -30, z: 20, width: 20, depth: 20, height: 35, color: 0x7b9dc3 },
    { x: 30, z: 20, width: 16, depth: 16, height: 28, color: 0x9bb5c3 },
    { x: 0, z: 0, width: 25, depth: 25, height: 40, color: 0x6b8dc3 },
    { x: -15, z: -40, width: 12, depth: 12, height: 20, color: 0x7b9dc3 },
    { x: 15, z: -40, width: 14, depth: 14, height: 22, color: 0x8ba0c3 },
    { x: -15, z: 40, width: 13, depth: 13, height: 24, color: 0x9ba5c3 },
    { x: 15, z: 40, width: 17, depth: 17, height: 32, color: 0x7b95c3 }
  ]

  buildingConfigs.forEach(config => {
    const building = createBuilding(
      config.x,
      config.z,
      config.width,
      config.depth,
      config.height,
      config.color
    )
    buildings.push(building)
    scene.add(building)
  })
}

// 创建光照系统
function createLights() {
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, isDayTime.value ? 0.6 : 0.3)
  scene.add(ambientLight)
  lights.push(ambientLight)

  // 方向光（太阳光）
  const directionalLight = new THREE.DirectionalLight(0xffffff, isDayTime.value ? 1.0 : 0.3)
  directionalLight.position.set(50, 100, 50)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 500
  directionalLight.shadow.camera.left = -100
  directionalLight.shadow.camera.right = 100
  directionalLight.shadow.camera.top = 100
  directionalLight.shadow.camera.bottom = -100
  scene.add(directionalLight)
  lights.push(directionalLight)

  // 点光源（模拟路灯）
  for (let i = -80; i <= 80; i += 40) {
    for (let j = -80; j <= 80; j += 40) {
      const pointLight = new THREE.PointLight(0xffffaa, isDayTime.value ? 0 : 0.5, 30)
      pointLight.position.set(i, 5, j)
      scene.add(pointLight)
      lights.push(pointLight)
    }
  }
}

// 添加天空盒/背景
function createSky() {
  const skyGeometry = new THREE.SphereGeometry(500, 32, 32)
  const skyMaterial = new THREE.MeshBasicMaterial({
    color: isDayTime.value ? 0x87ceeb : 0x000033,
    side: THREE.BackSide
  })
  const sky = new THREE.Mesh(skyGeometry, skyMaterial)
  scene.add(sky)
}

// 切换昼夜模式
function toggleDayNight() {
  isDayTime.value = !isDayTime.value
  
  scene.background = new THREE.Color(isDayTime.value ? 0x87ceeb : 0x000033)
  scene.fog.color = new THREE.Color(isDayTime.value ? 0x87ceeb : 0x000033)
  
  lights.forEach(light => {
    if (light instanceof THREE.AmbientLight) {
      light.intensity = isDayTime.value ? 0.6 : 0.3
    } else if (light instanceof THREE.DirectionalLight) {
      light.intensity = isDayTime.value ? 1.0 : 0.3
      light.color = new THREE.Color(isDayTime.value ? 0xffffff : 0x4444ff)
    } else if (light instanceof THREE.PointLight) {
      light.intensity = isDayTime.value ? 0 : 0.5
    }
  })

  buildings.forEach(building => {
    building.children.forEach(child => {
      if (child.material && child.material.emissive !== undefined) {
        child.material.emissive = new THREE.Color(isDayTime.value ? 0x000000 : 0xffffaa)
        child.material.emissiveIntensity = isDayTime.value ? 0 : 0.5
      }
    })
  })
}

// 重置相机
function resetCamera() {
  camera.position.set(50, 40, 50)
  camera.lookAt(0, 0, 0)
  controls.target.set(0, 0, 0)
  controls.update()
}

// 切换线框模式
function toggleWireframe() {
  wireframeMode.value = !wireframeMode.value
  buildings.forEach(building => {
    building.traverse(child => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.wireframe = wireframeMode.value)
        } else {
          child.material.wireframe = wireframeMode.value
        }
      }
    })
  })
}

// 初始化场景
function init() {
  createGround()
  createBuildings()
  createLights()
  createSky()
  loading.value = false
}

// 动画循环
let animationId = null
function animate() {
  animationId = requestAnimationFrame(animate)
  
  controls.update()
  
  buildings.forEach((building, index) => {
    building.rotation.y += 0.0001 * (index % 2 === 0 ? 1 : -1)
  })
  
  if (stats) {
    stats.update()
  }
  renderer.render(scene, camera)
}

// 窗口大小调整
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

onMounted(async () => {
  try {
    const statsModule = await import('stats.js')
    Stats = statsModule.default || statsModule
  } catch (error) {
    console.warn('Failed to load stats.js:', error)
    Stats = class {
      constructor() {
        this.dom = document.createElement('div')
      }
      update() {}
    }
  }

  // 场景设置
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)
  scene.fog = new THREE.Fog(0x87ceeb, 100, 500)

  // 相机设置
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(50, 40, 50)
  camera.lookAt(0, 0, 0)

  // 渲染器设置
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setPixelRatio(window.devicePixelRatio)
  containerRef.value.appendChild(renderer.domElement)

  // 轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 20
  controls.maxDistance = 200

  // 性能监控
  if (Stats) {
    stats = new Stats()
    stats.dom.style.position = 'absolute'
    stats.dom.style.top = '20px'
    stats.dom.style.right = '20px'
    statsRef.value.appendChild(stats.dom)
  }

  // 初始化场景
  init()

  // 启动动画
  animate()

  // 窗口大小调整
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', handleResize)
  
  // 清理资源
  if (renderer) {
    renderer.dispose()
  }
  if (scene) {
    scene.traverse(object => {
      if (object.geometry) object.geometry.dispose()
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => mat.dispose())
        } else {
          object.material.dispose()
        }
      }
    })
  }
})
</script>

<style scoped>
.container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.three-container {
  width: 100%;
  height: 100%;
}

.stats {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 18px;
  z-index: 200;
}

.controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  padding: 15px 25px;
  border-radius: 25px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  gap: 15px;
  backdrop-filter: blur(10px);
}

.btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.btn:active {
  transform: translateY(0);
}
</style>

