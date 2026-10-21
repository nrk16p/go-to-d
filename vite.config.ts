import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /go-to-d/
export default defineConfig({
  base: '/go-to-d/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
