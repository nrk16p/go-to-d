import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /go-to-d/
export default defineConfig({
  base: '/go-to-d/',
  plugins: [react()],
  // KataGo networks are assets (the engine test imports the tiny one with ?inline).
  assetsInclude: ['**/*.bin.gz'],
  // The engine worker carries TF.js (about 830 kB); it loads in the background, after the app.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
