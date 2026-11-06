import { defineConfig } from '@playwright/test';

const port = '4391';
const baseUrl = `http://127.0.0.1:${port}`;

// The accessibility suite renders fixtures without a server, so it can't see a
// failure that only the production bundle has. This suite runs the real build.
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.smoke\.ts/u,
  forbidOnly: true,
  use: { baseURL: baseUrl },
  webServer: {
    command: 'bun serve.ts',
    // The health route answers 200 only after a real database query.
    url: `${baseUrl}/api/health`,
    // Reusing whatever answers on the port could test another app and pass.
    reuseExistingServer: false,
    timeout: 120_000,
    // serve.ts drops its database on SIGTERM. Playwright's default SIGKILL
    // would leave the database behind.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    env: {
      HOST: '127.0.0.1',
      PORT: port,
      NODE_ENV: 'production',
      WORDHOLD_PUBLIC_URL: baseUrl,
      WORDHOLD_OWNER_TIME_ZONE: 'Europe/Berlin',
      // The landing page fails without these. The test never completes a
      // sign-in, so placeholders are enough.
      AUTH_SECRET: 'placeholder-for-the-production-build-smoke-check',
      GITHUB_CLIENT_ID: 'placeholder',
      GITHUB_CLIENT_SECRET: 'placeholder',
      GITHUB_ALLOWED_USER_ID: '0',
    },
  },
});
