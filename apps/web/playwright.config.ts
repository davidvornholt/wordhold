import { createA11yPlaywrightConfig } from '@davidvornholt/a11y-testing/playwright-config';

// The tests use a prebuilt fixture bundle instead of the Vite dev server. The
// dev server reports ready before it has pre-bundled dependencies, so the first
// tests wait for that work, and each fixture change reloads about 280 separate
// modules, which exceeds assertion timeouts on a busy machine. vite preview
// starts listening only after the build has finished.
//
// NODE_ENV=development keeps React's development build, which the StrictMode
// fixtures need. MIMALLOC_ALLOW_THP=0 stops Rolldown's allocator from asking for
// transparent huge pages. On a host with fragmented memory, those requests
// trigger kernel memory compaction that can make the build take minutes
// instead of seconds.
export default createA11yPlaywrightConfig({
  baseUrl: 'http://127.0.0.1:4173',
  webServerCommand: [
    'MIMALLOC_ALLOW_THP=0 NODE_ENV=development vite build --config a11y/vite.config.ts',
    'vite preview --config a11y/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
  ].join(' && '),
});
