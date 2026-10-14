import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'a11y',
  plugins: [viteReact(), tailwindcss()],
  server: { allowedHosts: true },
  build: {
    // Playwright serves this build. Keep it out of the app's dist output.
    outDir: '../node_modules/.cache/a11y-fixtures',
    emptyOutDir: true,
    // The fixtures build into one test-only chunk that no user downloads.
    chunkSizeWarningLimit: 2048,
  },
});
