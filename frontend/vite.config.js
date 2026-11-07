import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    secure: false
  },
  '/ws': {
    target: 'ws://localhost:8000',
    ws: true,
    changeOrigin: true
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: apiProxy
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: apiProxy
  }
})
