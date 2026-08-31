import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import { nitroApiRouting } from './src/shared/development/nitro-api-routing.js';

export default defineConfig({
  // The GitHub OAuth app's callback URL names port 3000. Falling back to
  // another port would serve the app where sign-in silently redirects
  // elsewhere, so refuse to start instead.
  server: { port: 3000, strictPort: true },
  plugins: [
    nitroApiRouting(),
    tanstackStart(),
    nitro({ preset: 'bun' }),
    viteReact(),
    tailwindcss(),
  ],
});
