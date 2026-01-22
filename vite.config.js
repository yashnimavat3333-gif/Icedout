import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-appwrite': ['appwrite'],
          'vendor-ui': ['@paypal/react-paypal-js', 'lucide-react'],
        },
      },
    },
    sourcemap: true, // Add source maps for debugging
    chunkSizeWarningLimit: 1000,
  },
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
})