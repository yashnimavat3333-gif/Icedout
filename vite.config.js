import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import createPayPalOrder from './api/paypal/create-order.js'
import capturePayPalOrder from './api/paypal/capture-order.js'
import saveAbandonedCheckout from './api/abandoned-checkout/save.js'
import recoverAbandonedCheckout from './api/abandoned-checkout/recover.js'
import completeAbandonedCheckout from './api/abandoned-checkout/complete.js'
import listAdminAbandonedCheckouts from './api/admin/abandoned-checkouts.js'
import captureLead from './api/leads/capture.js'
import quoteLeadCart from './api/leads/quote.js'
import syncLeadCart from './api/leads/sync.js'
import markLeadPurchased from './api/leads/purchased.js'
import restoreLeadCart from './api/leads/restore.js'
import listAdminLeads from './api/admin/leads.js'

function paypalApiDevPlugin() {
  const routes = {
    '/api/paypal/create-order': createPayPalOrder,
    '/api/paypal/capture-order': capturePayPalOrder,
  }

  return {
    name: 'paypal-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      Object.assign(process.env, env)

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] || ''
        const handler = routes[url]
        if (!handler || req.method !== 'POST') return next()

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString('utf8')
          let body = {}
          if (raw) {
            try {
              body = JSON.parse(raw)
            } catch {
              body = {}
            }
          }

          const mockRes = {
            statusCode: 200,
            status(code) {
              this.statusCode = code
              return this
            },
            json(data) {
              res.statusCode = this.statusCode || 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            },
          }

          await handler({ method: req.method, body }, mockRes)
        } catch (err) {
          console.error('[paypal-api-dev]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Server error' }))
        }
      })
    },
  }
}

function abandonedCheckoutApiDevPlugin() {
  const routes = {
    '/api/abandoned-checkout/save': saveAbandonedCheckout,
    '/api/abandoned-checkout/recover': recoverAbandonedCheckout,
    '/api/abandoned-checkout/complete': completeAbandonedCheckout,
    '/api/admin/abandoned-checkouts': listAdminAbandonedCheckouts,
    '/api/leads/capture': captureLead,
    '/api/leads/quote': quoteLeadCart,
    '/api/leads/sync': syncLeadCart,
    '/api/leads/purchased': markLeadPurchased,
    '/api/leads/restore': restoreLeadCart,
    '/api/admin/leads': listAdminLeads,
  }

  return {
    name: 'abandoned-checkout-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      Object.assign(process.env, env)

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const path = url.split('?')[0]
        const handler = routes[path]
        if (!handler) return next()

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const raw = Buffer.concat(chunks).toString('utf8')
          let body = {}
          if (raw) {
            try { body = JSON.parse(raw) } catch { body = {} }
          }
          const mockRes = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this },
            json(data) {
              res.statusCode = this.statusCode || 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            },
          }
          await handler({ method: req.method, url, body, headers: req.headers, query: Object.fromEntries(new URL(url, 'http://local').searchParams) }, mockRes)
        } catch (err) {
          console.error('[abandoned-checkout-api-dev]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Server error' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    paypalApiDevPlugin(),
    abandonedCheckoutApiDevPlugin(),
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
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
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