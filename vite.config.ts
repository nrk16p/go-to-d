import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site from /go-to-d/
const BASE = '/go-to-d/'

// Theme colours from src/ui/theme.css (--page, light).
const PAGE_LIGHT = '#f1f4f0'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    // An installable app that opens offline after the first visit. The service worker precaches the app
    // shell (HTML, JS including the engine worker, CSS, fonts, icons) and TF.js's two .wasm files. The
    // KataGo network (3.8 MB) is cached the first time the engine fetches it, then served from the cache.
    VitePWA({
      registerType: 'autoUpdate',
      // A plain register script: a new version takes over quietly and shows on the next load. No forced
      // reload, so a drill in progress is never cut off.
      injectRegister: 'script-defer',
      // globPatterns below already covers the icons; listing them again would double the precache list.
      includeManifestIcons: false,
      manifest: {
        id: BASE,
        name: 'Go-to-D',
        short_name: 'Go-to-D',
        lang: 'en',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        theme_color: PAGE_LIGHT,
        background_color: PAGE_LIGHT,
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The plugin adds manifest.webmanifest itself.
        globPatterns: [
          '**/*.{js,css,html,woff2,svg,png}',
          // TF.js's .wasm files have no version in their names, so they are precached: Workbox revisions
          // them by content, and a TF.js upgrade replaces them. The threaded build is left out; it needs
          // cross-origin isolation, which GitHub Pages doesn't give.
          'tfjs/tfjs-backend-wasm.wasm',
          'tfjs/tfjs-backend-wasm-simd.wasm',
        ],
        // autoUpdate: a new version takes over at once (the plugin only sets these itself with
        // injectRegister 'auto'). The first visit is controlled straight away too, so the network the
        // engine fetches at start can already land in the cache.
        skipWaiting: true,
        clientsClaim: true,
        // Hash routes: every page is index.html.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/models\/[^/?#]+\.bin\.gz$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'go-to-d-models',
              // The file name changes with the network, so the old one just ages out.
              expiration: { maxEntries: 2 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  // KataGo networks are assets (the engine test imports the tiny one with ?inline).
  assetsInclude: ['**/*.bin.gz'],
  // The engine worker carries TF.js (about 830 kB); it loads in the background, after the app.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
