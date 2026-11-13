import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates PNG/ICO icons from public/icon.svg. Run: npm run icons
// The artwork is full-bleed, so the normal icons get no padding; the maskable
// icon keeps its content inside the safe zone.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.15,
      resizeOptions: { background: '#0d0d12', fit: 'contain' },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: '#0d0d12', fit: 'contain' },
    },
  },
  images: ['public/icon.svg'],
});
