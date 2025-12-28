// === TypeScript类型声明 ===
// 这部分告诉TypeScript，window对象上有一个electronAPI属性
// 这样在Vue组件中使用window.electronAPI时，TypeScript不会报错

// 添加到 global.d.ts 或单独的类型文件
declare global {
    interface Window {
      electronAPI: {
        onMouseDown: (x: number, y: number) => void;      // 鼠标按下方法
        onMouseMove: (screenX: number, screenY: number) => void;  // 鼠标移动方法
        onMouseUp: () => void;                            // 鼠标松开方法
        onSystemInfo: (callback: (memUsage: number) => void) => void;  // 接收系统信息方法
        openFile: () => string;
        getPosition: () => number[];
        scanProgress: (callback: (path: string) => void) => void;
      };
    }
  }
  
  export {};
  
  // 解释：
  // - window.electronAPI.onMouseDown() - 在Vue组件中调用，通知主进程鼠标按下
  // - window.electronAPI.onMouseMove() - 在Vue组件中调用，通知主进程鼠标移动
  // - window.electronAPI.onMouseUp() - 在Vue组件中调用，通知主进程鼠标松开
  // - window.electronAPI.onSystemInfo() - 在Vue组件中调用，注册一个回调函数来接收内存数据