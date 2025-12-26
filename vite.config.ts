import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 根据环境变量决定 base 路径
  // Netlify: 使用根路径 '/'
  // GitHub Pages: 使用子路径 '/exam/'
  base: process.env.NETLIFY ? '/' : '/exam/',
})
