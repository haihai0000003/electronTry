<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
const scaningFile = ref('')
const handleClick = async () => {
  const filePath = await window.electronAPI.openFile({properties: ['openDirectory']})
  console.log(filePath)
}

window.electronAPI.scanProgress((path) => {
  scaningFile.value = path
})

const NOTIFICATION_TITLE = 'Title'
const NOTIFICATION_BODY = 'Notification from the Renderer process. Click to log to console.'
const CLICK_MESSAGE = 'Notification clicked!'

new window.Notification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY })

const selectPhoto = () => {
  
}
</script>

<template>
  <div class="card">
    <button type="button" @click="handleClick" class="px-[10px] py-[5px] border">扫描</button>
    <p>正在扫描的文件：{{scaningFile}}</p>
  </div>

  <div>
    <button class="px-[10px] py-[5px] border" @click="selectPhoto">选择图片</button>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
