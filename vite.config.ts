import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(), tailwindcss(),
    // The production CSP forbids Vite's inline hot-reload preamble. Development
    // is loopback-only; keep production and preview CSP unchanged.
    { name: 'local-development-csp', apply: 'serve', transformIndexHtml(html) {
      return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, '');
    } },
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 1400 },
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
