import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api/appwrite': {
        target: 'https://fra.cloud.appwrite.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/appwrite/, ''),
      }
    }
  }
  // No build options needed - Vite uses sensible defaults
})