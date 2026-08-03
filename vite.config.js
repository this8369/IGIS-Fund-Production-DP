import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const emitMobileEntry = () => ({
  name: 'emit-mobile-entry',
  apply: 'build',
  async closeBundle() {
    const distDirectory = resolve(process.cwd(), 'dist')
    const mobileDirectory = resolve(distDirectory, 'mobile')

    await mkdir(mobileDirectory, { recursive: true })
    await copyFile(
      resolve(distDirectory, 'index.html'),
      resolve(mobileDirectory, 'index.html'),
    )
  },
})

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    emitMobileEntry(),
  ],
  server: {
    host: true,
    allowedHosts: true,
    port: mode === 'staging' ? 8082 : 8081,
    strictPort: true, // 포트 꼬임 방지 (8081/8082가 아니면 차라리 에러를 띄움)
    watch: process.env.VITE_USE_POLLING === 'true'
      ? { usePolling: true, interval: 100 }
      : undefined,
    hmr: {
      overlay: true,
    },
    proxy: {
      '/google-news-rss': {
        target: 'https://news.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/google-news-rss/, ''),
      }
    }
  },
  preview: {
    allowedHosts: true,
  },
}))
