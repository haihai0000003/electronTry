/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html', // 主入口 HTML
    './src/**/*.{vue,js,ts,jsx,tsx}', // 所有渲染进程源码
    // 若有预加载脚本（preload）需使用 Tailwind，也需加入
    './src/preload/**/*.{js,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

