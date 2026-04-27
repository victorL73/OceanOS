import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Mobywork/',

  // ─── Dev Server ─────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      // En dev : proxy /api vers le backend local
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      }
    }
  },

  // ─── Build Production ────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Code splitting pour de meilleures performances
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
          http: ['axios'],
        }
      }
    },
    // Limite avertissement taille chunks (kB)
    chunkSizeWarningLimit: 600,
  },

  // ─── Optimisations ───────────────────────────────────────
  optimizeDeps: {
    include: ['react', 'react-dom', 'axios', 'lucide-react', 'recharts']
  }
})
