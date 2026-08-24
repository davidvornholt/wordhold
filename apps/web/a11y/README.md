# Browser accessibility fixtures

The browser gate runs a dedicated Vite fixture server because the production routes require GitHub OAuth, PostgreSQL, object storage, and paid AI providers. Those dependencies would make accessibility scans nondeterministic and unsafe in pull-request CI.

The fixtures faithfully reproduce the production landmarks, controls, feedback, and transitions without importing application modules into the test-only Tailwind entrypoint. This keeps the gate isolated from infrastructure and prevents the test build from changing production module analysis. Browser assertions cover the signed-out transition and the authenticated dashboard-to-import, verification, and practice flow before Axe scans every meaningful state on desktop and mobile Chromium.

The fixture server is test-only and is never included in the production TanStack build.
