import { BrowserWindow, ipcMain, screen, app, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as os from "os";
import { Worker } from "worker_threads";
const __dirname$2 = path.dirname(fileURLToPath(import.meta.url));
let trayWindow = null;
function createTrayWindow() {
  console.log(path.join(__dirname$2, "preload.ts"));
  trayWindow = new BrowserWindow({
    width: 100,
    height: 100,
    x: 100,
    y: 200,
    frame: false,
    // 不显示窗口边框（标题栏、最小化按钮等）
    transparent: true,
    // 窗口背景透明，这样只显示我们绘制的圆球
    alwaysOnTop: true,
    // 窗口始终置顶，不会被其他窗口遮挡
    skipTaskbar: true,
    // 不在任务栏显示这个窗口的图标
    resizable: false,
    // 不允许用户调整窗口大小
    hasShadow: false,
    // 不显示窗口阴影（因为我们有自定义阴影）
    webPreferences: {
      // Web相关的偏好设置
      nodeIntegration: false,
      // 不允许在渲染进程直接使用Node.js（安全考虑）
      contextIsolation: true,
      // 开启上下文隔离（安全特性，隔离主进程和渲染进程）
      preload: path.join(__dirname$2, "preload.mjs")
      // 预加载脚本的路径，用来安全地暴露API给渲染进程
    }
  });
  trayWindow.setIgnoreMouseEvents(false);
  trayWindow.loadURL("http://localhost:5173/#/float-ball");
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  ipcMain.on("float-ball-mousedown", (_event, { x, y }) => {
    isDragging = true;
    dragOffset = { x, y };
  });
  ipcMain.on("float-ball-mousemove", (_event, { screenX, screenY }) => {
    if (isDragging && trayWindow) {
      trayWindow.setPosition(
        Math.round(screenX - dragOffset.x),
        Math.round(screenY - dragOffset.y)
      );
    }
  });
  ipcMain.on("float-ball-mouseup", () => {
    isDragging = false;
    snapToEdge();
  });
  function snapToEdge() {
    if (!trayWindow) return;
    const bounds = trayWindow.getBounds();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const threshold = 50;
    let targetX = bounds.x;
    let targetY = bounds.y;
    if (bounds.x < threshold) {
      targetX = 10;
    } else if (bounds.x > width - bounds.width - threshold) {
      targetX = width - bounds.width - 10;
    }
    if (bounds.y < threshold) {
      targetY = 10;
    } else if (bounds.y > height - bounds.height - threshold) {
      targetY = height - bounds.height - 10;
    }
    trayWindow.setPosition(targetX, targetY);
  }
  setInterval(() => {
    if (trayWindow && !trayWindow.isDestroyed()) {
      const memoRate = getMemoryUsage();
      trayWindow == null ? void 0 : trayWindow.webContents.send("system-info", memoRate);
    }
  }, 2e3);
  const handlePostion = () => {
    if (trayWindow) {
      return trayWindow.getPosition();
    }
    return [0, 0];
  };
  ipcMain.handle("window:get-position", handlePostion);
}
function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return Math.round(usedMem / totalMem * 100);
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
async function handleFileOpen(event) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (!canceled) {
    const filePath = filePaths[0];
    return new Promise((resolve) => {
      const worker = new Worker(path.join(__dirname$1, "./worker.js"), {
        workerData: { path: filePath },
        execArgv: ["--experimental-specifier-resolution=node"]
      });
      worker.on("message", (msg) => {
        if (msg.type === "complete") {
          resolve(msg.files);
        } else if (msg.type === "progress") {
          event.sender.send("scan-progress", msg.path);
        }
      });
      worker.on("error", (err) => {
        console.log(err);
        resolve([]);
      });
    });
  }
}
app.whenReady().then(() => {
  ipcMain.handle("dialog:openFile", handleFileOpen);
  createWindow();
  createTrayWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
