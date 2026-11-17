import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Avoid broken prebundled maplibre worker MIME / 504 Outdated Optimize Dep
    exclude: ['maplibre-gl'],
  },
  worker: {
    format: 'es',
  },
})
