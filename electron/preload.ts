
// preload.ts - 预加载脚本
// 这个文件运行在一个特殊的环境中，可以同时访问部分Node.js API和浏览器API

// contextBridge: Electron提供的桥接模块，用于安全地暴露API给渲染进程
// ipcRenderer: 渲染进程的通信模块，用于向主进程发送消息和接收消息
import { ipcRenderer, contextBridge, OpenDialogOptions } from 'electron'
// contextBridge.exposeInMainWorld(): 安全地向渲染进程暴露API
// 第一个参数 'electronAPI'(想叫什么叫什么): 在渲染进程中访问的对象名称（window.electronAPI）
// 第二个参数：要暴露的API对象
contextBridge.exposeInMainWorld('electronAPI', {
  // on(...args: Parameters<typeof ipcRenderer.on>) {
  //   const [channel, listener] = args
  //   return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  // },
  // off(...args: Parameters<typeof ipcRenderer.off>) {
  //   const [channel, ...omit] = args
  //   return ipcRenderer.off(channel, ...omit)
  // },
  // send(...args: Parameters<typeof ipcRenderer.send>) {
  //   const [channel, ...omit] = args
  //   return ipcRenderer.send(channel, ...omit)
  // },
  // invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
  //   const [channel, ...omit] = args
  //   return ipcRenderer.invoke(channel, ...omit)
  // },

    // 鼠标按下事件：传递鼠标相对于窗口的坐标
  onMouseDown: (x: number, y: number) => {
    // ipcRenderer.send(): 向主进程发送消息（单向通信）
    // 'float-ball-mousedown': 消息的名称（频道名），主进程会监听这个名称
    // { x, y }: 发送的数据对象
    ipcRenderer.send('float-ball-mousedown', { x, y });
  },
  // 鼠标移动事件：传递鼠标在屏幕上的绝对坐标
  onMouseMove: (screenX: number, screenY: number) => {
    ipcRenderer.send('float-ball-mousemove', { screenX, screenY });
  },
  
  // 鼠标松开事件：通知主进程停止拖动
  onMouseUp: () => {
    ipcRenderer.send('float-ball-mouseup');
  },
  
  // === 接收主进程消息的API ===
  
  // 监听系统信息：接收主进程发来的内存占用率
  // callback: 回调函数，当收到消息时会被调用
  onSystemInfo: (callback: (memUsage: number) => void) => {
    // ipcRenderer.on(): 监听来自主进程的消息
    // 'system-info': 要监听的消息名称
    // (event, memUsage) => {...}: 收到消息时执行的回调函数
    //   - event: 事件对象（通常不需要使用）
    //   - memUsage: 主进程发送的数据（内存占用率）
    ipcRenderer.on('system-info', (event, memUsage) => {
      callback(memUsage);  // 调用传入的回调函数，把数据传递给它
    });
  },

  openFile: (options?: OpenDialogOptions) => ipcRenderer.invoke('dialog:openFile', options),

  scanProgress: (callback: (path: string) => void) => {
    ipcRenderer.on('scan-progress', (event, path) => {
      callback(path)
    })
  }
})

