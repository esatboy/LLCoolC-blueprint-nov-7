import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_NAME, APP_TAGLINE } from './src/config.ts';

// `npm run dev:phone` serves over HTTPS (self-signed) on your LAN. Phones only allow the camera,
// microphone and service worker on secure origins, so plain http://<LAN-IP> can't test those.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'phone' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: APP_TAGLINE,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf5ec',
        theme_color: '#b4472a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
