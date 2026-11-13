import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Shown in the settings sheet: "v666.12 · 394ce6d · 13.11.2026 klo 14.32"
// The number after 666 is the git commit count, so it goes up with every commit.
function git(cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null; // not a git checkout
  }
}

function appVersion(): string {
  const count = git('rev-list --count HEAD') ?? '0';
  const sha = git('rev-parse --short HEAD') ?? 'dev';
  const built = new Date().toLocaleString('fi-FI', {
    timeZone: 'Europe/Helsinki',
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return `v666.${count} · ${sha} · ${built}`;
}

export default defineConfig({
  // Relative asset paths so the build works under /vibecoding/ on GitHub Pages
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
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
