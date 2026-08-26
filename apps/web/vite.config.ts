import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // The GitHub OAuth app's callback URL names port 3000. Falling back to
  // another port would serve the app where sign-in silently redirects
  // elsewhere, so refuse to start instead.
  server: { port: 3000, strictPort: true },
  plugins: [tanstackStart(), viteReact(), tailwindcss()],
});
