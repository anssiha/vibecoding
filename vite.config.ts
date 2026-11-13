import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative asset paths so the build works under /vibecoding/ on GitHub Pages
  base: './',
  plugins: [
    VitePWA({
      // 'prompt': a new version waits until the user taps "Päivitä" (see src/pwa.ts)
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Viimeinen Rokkari pystyssä',
        short_name: 'Rokkari',
        description: 'Kuka juo? Sormipeli juomaporukalle.',
        lang: 'fi',
        // Relative so it works wherever the site is hosted (e.g. /vibecoding/)
        id: './',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d0d12',
        theme_color: '#0d0d12',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
