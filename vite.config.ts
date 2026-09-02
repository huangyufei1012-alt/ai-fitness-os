import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // 构建前不清空 outDir：避免沙箱 safe-delete 拦截 fs.rmSync 导致构建失败
  // （新资产写入新哈希文件，index.html 指向最新文件，旧文件无害遗留）
  build: { emptyOutDir: false },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
