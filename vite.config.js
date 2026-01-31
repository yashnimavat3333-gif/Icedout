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
          'vendor-editor': ['@tinymce/tinymce-react', 'tinymce', 'quill'],
          'vendor-animation': ['framer-motion', 'gsap', 'lenis'],
        },
      },
    },
    // Disable source maps in production for better performance (saves ~4MB)
    sourcemap: false,
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Use esbuild minification (faster, built-in)
    minify: 'esbuild',
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