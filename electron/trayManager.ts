import {BrowserWindow, screen, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import * as os from 'os';

let trayWindow: BrowserWindow | null = null

export function createTrayWindow() {
    console.log(path.join(__dirname, 'preload.ts'))
    trayWindow = new BrowserWindow({
        width: 100,
        height: 100,
        x: 100,
        y: 200,
        frame: false,           // 不显示窗口边框（标题栏、最小化按钮等）
        transparent: true,      // 窗口背景透明，这样只显示我们绘制的圆球
        alwaysOnTop: true,      // 窗口始终置顶，不会被其他窗口遮挡
        skipTaskbar: true,      // 不在任务栏显示这个窗口的图标
        resizable: false,       // 不允许用户调整窗口大小
        hasShadow: false,       // 不显示窗口阴影（因为我们有自定义阴影）
        webPreferences: {       // Web相关的偏好设置
          nodeIntegration: false,      // 不允许在渲染进程直接使用Node.js（安全考虑）
          contextIsolation: true,      // 开启上下文隔离（安全特性，隔离主进程和渲染进程）
          preload: path.join(__dirname, 'preload.mjs')  // 预加载脚本的路径，用来安全地暴露API给渲染进程
        }
    })
    // setIgnoreMouseEvents(): 设置是否忽略鼠标事件
    // false表示不忽略，窗口可以响应鼠标点击和拖动
    trayWindow.setIgnoreMouseEvents(false)
    // loadURL(): 加载网页内容到这个窗口
    trayWindow.loadURL('http://localhost:5173/#/float-ball')

    // 处理拖动的逻辑
    let isDragging = false;                    // 标记是否正在拖动
    let dragOffset = { x: 0, y: 0 };          // 记录鼠标点击位置相对于窗口的偏移量

      // ipcMain.on(): 监听来自渲染进程的消息
  // 'float-ball-mousedown': 消息的名称（频道名）
  // event: 事件对象（包含发送者信息等）
  // { x, y }: 接收的数据，这里是鼠标相对于窗口的坐标
  ipcMain.on('float-ball-mousedown', (_event, { x, y }) => {
    isDragging = true;  // 标记开始拖动
    // 记录鼠标点击位置，用于计算拖动时的偏移
    dragOffset = { x: x, y: y };
  });

  // 监听鼠标移动消息
  // screenX, screenY: 鼠标在整个屏幕上的绝对坐标
  ipcMain.on('float-ball-mousemove', (_event, { screenX, screenY }) => {

    if (isDragging && trayWindow) {
      // setPosition(): 设置窗口的位置
      // 用屏幕坐标减去偏移量，让球跟随鼠标移动
      trayWindow.setPosition(
        Math.round(screenX - dragOffset.x),
        Math.round(screenY - dragOffset.y)
      );
    }
  });

  // 监听鼠标松开消息
  ipcMain.on('float-ball-mouseup', () => {
    isDragging = false;  // 结束拖动
    // 可选：调用边缘吸附函数，让球吸附到屏幕边缘
    snapToEdge();
  });

  // 边缘吸附函数：让悬浮球自动吸附到屏幕四个边缘
  function snapToEdge() {
    if (!trayWindow) return;
    
    // getBounds(): 获取窗口当前的位置和尺寸
    const bounds = trayWindow.getBounds();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const threshold = 50;  // 吸附阈值：当球距离边缘小于50像素时，自动吸附

    // 先默认当前位置
    let targetX = bounds.x;
    let targetY = bounds.y;

    // 水平方向：左 / 右 边缘吸附
    if (bounds.x < threshold) {
      // 靠近左边缘
      targetX = 10; // 吸附到左边，留 10 像素边距
    } else if (bounds.x > width - bounds.width - threshold) {
      // 靠近右边缘
      targetX = width - bounds.width - 10; // 吸附到右边
    }

    // 垂直方向：上 / 下 边缘吸附
    if (bounds.y < threshold) {
      // 靠近上边缘
      targetY = 10; // 吸附到上边，留 10 像素边距
    } else if (bounds.y > height - bounds.height - threshold) {
      // 靠近下边缘
      targetY = height - bounds.height - 10; // 吸附到下边
    }

    trayWindow.setPosition(targetX, targetY);
  }


  setInterval(() => {
    if(trayWindow && !trayWindow.isDestroyed()) {
      const memoRate = getMemoryUsage()
      trayWindow?.webContents.send('system-info', memoRate)
    }
  }, 2000)

  const handlePostion = () => {
    if(trayWindow) {
      return trayWindow.getPosition()
    }
    return [0,0]
  }

  ipcMain.handle('window:get-position', handlePostion)

} 

// 获取内存占用率的函数
function getMemoryUsage(): number {
  // os.totalmem(): 获取系统总内存（单位：字节）
  const totalMem = os.totalmem();
  // os.freemem(): 获取系统空闲内存（单位：字节）
  const freeMem = os.freemem();
  // 计算已使用的内存 = 总内存 - 空闲内存
  const usedMem = totalMem - freeMem;
  // 计算内存占用率百分比，并四舍五入
  // (已使用 / 总内存) * 100 = 占用率百分比
  return Math.round((usedMem / totalMem) * 100);
}