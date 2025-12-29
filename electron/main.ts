import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent, Notification, OpenDialogOptions, ContextMenuParams, ContextMenuEvent } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {createTrayWindow} from './trayManager'
import {Worker} from 'worker_threads'
import { createminiTray } from './miniTray'
import {buildContextMenu} from './utils'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      devTools: true
    },
  })
  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // win.webContents.on('did-finish-load', () => {
    //   if(win?.webContents.isDevToolsOpened()) {
    //     win.webContents.openDevTools({mode: 'detach'})
    //   }
    // })

    // win.webContents.on('did-frame-finish-load', () => {
    //   if (!win?.webContents.isDevToolsOpened()) {
    //     win?.webContents.openDevTools({ mode: 'detach' });
    //   }
    // });
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.on('closed', (e: Event) => {
    e.preventDefault(); // 阻止默认的窗口关闭（应用退出）行为
    win?.hide(); // 隐藏主窗口
    return false; // 取消关闭操作
  })

  win.webContents.on('context-menu', (event, params: ContextMenuParams) => {
    event.preventDefault();
    const customMenu = buildContextMenu(win!);
    console.log('customMenu')
    customMenu.popup({
      window: win!,
      x: params.x,
      y: params.y
    });
  })
}

const NOTIFICATION_TITLE = 'Basic Notification'
const NOTIFICATION_BODY = 'Notification from the Main process'

function showNotification () {
  new Notification({ title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY }).show()
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

let c = 0.64
async function handleFileOpen (event: IpcMainInvokeEvent, options?: OpenDialogOptions) {
  const { canceled, filePaths } = await dialog.showOpenDialog(options?? {})
  if (!canceled) {
    const filePath = filePaths[0] 
    return new Promise((resolve) => {
      const worker = new Worker(path.join(__dirname, './worker.js'), {workerData: {path: filePath},
      execArgv: ['--experimental-specifier-resolution=node']
    })

      worker.on('message', (msg) => {
        if(msg.type === 'complete') {
          c = 1
          win?.setProgressBar(c)
          resolve(msg.files)
        } else if(msg.type === 'progress') {
          win?.setProgressBar(c)
          event.sender.send('scan-progress', msg.path)
        }
      })

      // 监听 Worker 错误
      worker.on('error', (err) => {
        // event.sender.send('scan-error', { error: err.message });
        console.log(err)
        resolve([]);
      });
    })
  }
}



app.whenReady().then(() => {
  ipcMain.handle('dialog:openFile', handleFileOpen)
  createWindow()
  createTrayWindow()
  createminiTray(win)
})
