"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
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
  onMouseDown: (x, y) => {
    electron.ipcRenderer.send("float-ball-mousedown", { x, y });
  },
  // 鼠标移动事件：传递鼠标在屏幕上的绝对坐标
  onMouseMove: (screenX, screenY) => {
    electron.ipcRenderer.send("float-ball-mousemove", { screenX, screenY });
  },
  // 鼠标松开事件：通知主进程停止拖动
  onMouseUp: () => {
    electron.ipcRenderer.send("float-ball-mouseup");
  },
  // === 接收主进程消息的API ===
  // 监听系统信息：接收主进程发来的内存占用率
  // callback: 回调函数，当收到消息时会被调用
  onSystemInfo: (callback) => {
    electron.ipcRenderer.on("system-info", (event, memUsage) => {
      callback(memUsage);
    });
  },
  openFile: () => electron.ipcRenderer.invoke("dialog:openFile"),
  scanProgress: (callback) => {
    electron.ipcRenderer.on("scan-progress", (event, path) => {
      callback(path);
    });
  }
});
