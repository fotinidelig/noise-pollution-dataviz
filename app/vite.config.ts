import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages project site: set VITE_BASE=/<repo>/ when building for Pages.
// Local/dev default is '/'.
const base = process.env.VITE_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  optimizeDeps: {
    // Avoid broken prebundled maplibre worker MIME / 504 Outdated Optimize Dep
    exclude: ['maplibre-gl'],
  },
  worker: {
    format: 'es',
  },
})
