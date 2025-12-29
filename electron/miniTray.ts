import { app,BrowserWindow, Tray, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
let tray: Tray | null = null

export function createminiTray(mainWindow: BrowserWindow | null) {
    console.log('run')
    const trayIcon = path.join(__dirname, '../public/zt41i-8xkjx-001.ico');

    tray = new Tray(trayIcon);
    tray.setToolTip('Note Box');

    // 3. 创建托盘右键菜单
  const trayMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        // 恢复窗口并聚焦
        mainWindow?.show();
        mainWindow?.focus();
        // 可选：取消最小化状态
        mainWindow?.restore();
        // 隐藏托盘（可选，根据需求）
        // tray?.setVisible(false);
      },
    },
    {
      label: '退出应用',
      click: () => {
        // 销毁托盘
        tray?.destroy();
        // 关闭窗口并退出应用
        mainWindow?.close();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(trayMenu);

//   tray.on('click', () => {
//     // 单击托盘图标时显示窗口
//     mainWindow?.show();
//     mainWindow?.focus();
//     // 可选：取消最小化状态
//     mainWindow?.restore();
//     // 隐藏托盘（可选，根据需求）
//     // tray?.setVisible(false);
//   });
}