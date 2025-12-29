import {Menu, MenuItem, BrowserWindow} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const buildContextMenu = (mainWindow: BrowserWindow) => {
  const contextMenu = new Menu()
  contextMenu.append(new MenuItem({
    label: '复制',
    role: 'copy',
    accelerator: 'CmdOrCtrl+C',
    enabled: true
  }))
  contextMenu.append(
    new MenuItem({
      label: '粘贴',
      role: 'paste',
      accelerator: 'CmdOrCtrl+V',
      enabled: true
    })
  );

  // 添加分隔线
  contextMenu.append(new MenuItem({ type: 'separator' }));

   // 自定义菜单项（非内置角色，需手动配置点击事件）
   contextMenu.append(
    new MenuItem({
      label: '刷新页面',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.reload(); // 刷新当前窗口
        }
      },
      visible: true // 是否可见
    })
  );

  contextMenu.append(
    new MenuItem({
      label: '开发者工具',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      },
      accelerator: 'F12'
    })
  );
  return contextMenu;
}