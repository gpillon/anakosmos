import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // clearScreen: false,     // non cancella la console
  // logLevel: "info",       // oppure "warn"
  server: {
    host: true, // Listen on all addresses
    strictPort: true,
    hmr: { overlay: true }, // overlay errori nel browser,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true
      }
    },
    watch: {
      usePolling: true, // Needed for WSL2 in some cases
    }
  }
})
