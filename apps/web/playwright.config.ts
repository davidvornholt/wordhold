import { createA11yPlaywrightConfig } from '@davidvornholt/a11y-testing/playwright-config';

export default createA11yPlaywrightConfig({
  baseUrl: 'http://127.0.0.1:4173',
  webServerCommand:
    'vite --config a11y/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
});
