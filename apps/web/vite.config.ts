import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Dev server only: lets cloud previews and tunnels (non-localhost hostnames) reach it.
    allowedHosts: true,
    proxy: { '/api': 'http://localhost:4100' },
  },
  preview: {
    port: 5173,
    allowedHosts: true,
    proxy: { '/api': 'http://localhost:4100' },
  },
});

