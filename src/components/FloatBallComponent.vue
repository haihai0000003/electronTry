<template>
  <div class="float-ball-container">
    <div 
      class="float-ball"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <!-- 水波纹容器 -->
      <div class="wave-container">
        <svg class="wave-svg" viewBox="0 0 100 100">
          <defs>
            <clipPath id="circle-clip">
              <circle cx="50" cy="50" r="40" />
            </clipPath>
          </defs>
          
          <!-- 背景圆 -->
          <circle cx="50" cy="50" r="40" fill="#1e40af" opacity="0.2" />
          
          <!-- 水波纹 -->
          <g clip-path="url(#circle-clip)">
            <path
              :d="wavePath1"
              :fill="waveColor"
              opacity="0.6"
              :transform="`translate(${waveOffset1}, 0)`"
            />
            <path
              :d="wavePath2"
              :fill="waveColor"
              opacity="0.4"
              :transform="`translate(${waveOffset2}, 0)`"
            />
          </g>
        </svg>
      </div>

      <!-- 内存占用率显示 -->
      <div class="memory-display">
        <div class="memory-text">{{ memoryUsage }}%</div>
        <div class="memory-label">MEM</div>
      </div>

      <!-- 光晕效果 -->
      <div class="glow-effect"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const memoryUsage = ref(0);
const waveOffset1 = ref(0);
const waveOffset2 = ref(0);
let animationFrame: number;

// 根据内存占用率改变颜色
const waveColor = computed(() => {
  if (memoryUsage.value < 50) return '#3b82f6'; // 蓝色
  if (memoryUsage.value < 80) return '#f59e0b'; // 橙色
  return '#ef4444'; // 红色
});

// 生成波浪路径
const wavePath1 = computed(() => {
  const amplitude = 5;
  const frequency = 2;
  const waterLevel = 90 - (memoryUsage.value * 0.6); // 根据内存占用调整水位
  
  let path = `M 0 ${waterLevel}`;
  for (let x = 0; x <= 100; x += 2) {
    const y = waterLevel + Math.sin((x + waveOffset1.value) * frequency * Math.PI / 50) * amplitude;
    path += ` L ${x} ${y}`;
  }
  path += ` L 100 100 L 0 100 Z`;
  return path;
});

const wavePath2 = computed(() => {
  const amplitude = 4;
  const frequency = 2.5;
  const waterLevel = 90 - (memoryUsage.value * 0.6);
  
  let path = `M 0 ${waterLevel}`;
  for (let x = 0; x <= 100; x += 2) {
    const y = waterLevel + Math.cos((x + waveOffset2.value) * frequency * Math.PI / 50) * amplitude;
    path += ` L ${x} ${y}`;
  }
  path += ` L 100 100 L 0 100 Z`;
  return path;
});

// 水波动画
function animateWaves() {
  waveOffset1.value = (waveOffset1.value + 0.5) % 100;
  waveOffset2.value = (waveOffset2.value + 0.3) % 100;
  animationFrame = requestAnimationFrame(animateWaves);
}

// 拖动相关
const isDragging = ref(false);

function handleMouseDown(e: MouseEvent) {
  isDragging.value = true;
  if (window.electronAPI) {
    window.electronAPI.onMouseDown(e.clientX, e.clientY);
  }
}

function handleMouseMove(e: MouseEvent) {
  if (isDragging.value && window.electronAPI) {
    window.electronAPI.onMouseMove(e.screenX, e.screenY);
  }
}

function handleMouseUp() {
  if (isDragging.value && window.electronAPI) {
    isDragging.value = false;
    window.electronAPI.onMouseUp();
  }
}

onMounted(() => {
  // 启动水波动画
  animateWaves();

  // 监听系统信息
  if (window.electronAPI) {
    window.electronAPI.onSystemInfo((usage: number) => {
      memoryUsage.value = usage;
    });
  } else {
    // 开发环境模拟数据
    setInterval(() => {
      memoryUsage.value = Math.floor(Math.random() * 100);
    }, 2000);
  }
});

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
});
</script>

<style scoped>
.float-ball-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
  overflow: hidden;
}

.float-ball {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  position: relative;
  cursor: move;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
  user-select: none;
}

.float-ball:hover {
  transform: scale(1.05);
}

.float-ball:active {
  transform: scale(0.98);
}

.wave-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.wave-svg {
  width: 100%;
  height: 100%;
}

.memory-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: white;
  font-weight: bold;
  z-index: 10;
  pointer-events: none;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.memory-text {
  font-size: 18px;
  line-height: 1;
  margin-bottom: 2px;
}

.memory-label {
  font-size: 10px;
  opacity: 0.9;
  letter-spacing: 1px;
}

.glow-effect {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.float-ball:hover .glow-effect {
  opacity: 1;
}

/* 拖动时的样式 */
.float-ball:active .glow-effect {
  opacity: 1;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, transparent 70%);
}
</style>