/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/appvid/', // Set the base path for hosting in a subdirectory
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'AppVid',
        short_name: 'AppVid',
        description: 'Create app store preview videos locally in your browser.',
        start_url: '.',
        display: 'standalone',
        theme_color: '#18181b', // Zinc-900 background matching the dark theme
        background_color: '#18181b',
        icons: [
          {
            src: '/appvid/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/appvid/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/appvid/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
});
