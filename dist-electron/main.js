import { BrowserWindow, ipcMain, screen, Tray, Menu, app, MenuItem, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as os from "os";
import { Worker } from "worker_threads";
const __dirname$4 = path.dirname(fileURLToPath(import.meta.url));
let trayWindow = null;
function createTrayWindow() {
  console.log(path.join(__dirname$4, "preload.ts"));
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
      preload: path.join(__dirname$4, "preload.mjs")
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
const __dirname$3 = path.dirname(fileURLToPath(import.meta.url));
let tray = null;
function createminiTray(mainWindow) {
  console.log("run");
  const trayIcon = path.join(__dirname$3, "../public/zt41i-8xkjx-001.ico");
  tray = new Tray(trayIcon);
  tray.setToolTip("Note Box");
  const trayMenu = Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: () => {
        mainWindow == null ? void 0 : mainWindow.show();
        mainWindow == null ? void 0 : mainWindow.focus();
        mainWindow == null ? void 0 : mainWindow.restore();
      }
    },
    {
      label: "退出应用",
      click: () => {
        tray == null ? void 0 : tray.destroy();
        mainWindow == null ? void 0 : mainWindow.close();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(trayMenu);
}
path.dirname(fileURLToPath(import.meta.url));
const buildContextMenu = (mainWindow) => {
  const contextMenu = new Menu();
  contextMenu.append(new MenuItem({
    label: "复制",
    role: "copy",
    accelerator: "CmdOrCtrl+C",
    enabled: true
  }));
  contextMenu.append(
    new MenuItem({
      label: "粘贴",
      role: "paste",
      accelerator: "CmdOrCtrl+V",
      enabled: true
    })
  );
  contextMenu.append(new MenuItem({ type: "separator" }));
  contextMenu.append(
    new MenuItem({
      label: "刷新页面",
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.reload();
        }
      },
      visible: true
      // 是否可见
    })
  );
  contextMenu.append(
    new MenuItem({
      label: "开发者工具",
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.openDevTools({ mode: "detach" });
        }
      },
      accelerator: "F12"
    })
  );
  return contextMenu;
};
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
      preload: path.join(__dirname$1, "preload.mjs"),
      devTools: true
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
  win.on("closed", (e) => {
    e.preventDefault();
    win == null ? void 0 : win.hide();
    return false;
  });
  win.webContents.on("context-menu", (event, params) => {
    event.preventDefault();
    const customMenu = buildContextMenu(win);
    console.log("customMenu");
    customMenu.popup({
      window: win,
      x: params.x,
      y: params.y
    });
  });
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
let c = 0.64;
async function handleFileOpen(event, options) {
  const { canceled, filePaths } = await dialog.showOpenDialog(options ?? {});
  if (!canceled) {
    const filePath = filePaths[0];
    return new Promise((resolve) => {
      const worker = new Worker(path.join(__dirname$1, "./worker.js"), {
        workerData: { path: filePath },
        execArgv: ["--experimental-specifier-resolution=node"]
      });
      worker.on("message", (msg) => {
        if (msg.type === "complete") {
          c = 1;
          win == null ? void 0 : win.setProgressBar(c);
          resolve(msg.files);
        } else if (msg.type === "progress") {
          win == null ? void 0 : win.setProgressBar(c);
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
  createminiTray(win);
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
