import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // Keep every asset as a file so the CSP can stay `img-src 'self'` / `font-src 'self'`.
    assetsInlineLimit: 0,
    rollupOptions: {
      // static policy pages ship as plain HTML (no JavaScript needed to read them)
      input: { main: 'index.html', privacy: 'privacy/index.html', terms: 'terms/index.html' },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{js,jsx}'],
  },
});
