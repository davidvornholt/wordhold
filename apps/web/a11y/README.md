# Browser accessibility fixtures

The browser gate runs a dedicated Vite fixture server because the production routes require GitHub OAuth, PostgreSQL, object storage, and paid AI providers. Those dependencies would make accessibility scans nondeterministic and unsafe in pull-request CI.

The fixture shells import the production presentation components and supply deterministic data, navigation controls, and async adapters. The covered production components are `HomeShell`, `CourseGrid`, `CourseCard`, `FragileList`, `PendingPages`, `CaptureScreen`, `VerifyForm`, `AudioRecovery`, `PracticeLayout`, `PracticeEmpty`, `CardPractice`, `FeedbackPanel`, `RootPending`, `RootError`, and `RootNotFound`. The fixture HTML loads the production stylesheet through a test-only CSS entry, so the browser sees the same component markup and styles without bringing server infrastructure into the module graph.

Browser assertions cover the signed-out transition and the authenticated dashboard-to-import, verification, and practice flow. Deferred-promise scenarios exercise the real `VerifyForm` and `CardPractice` state while a request is pending, including attempted edits, add/remove actions, repeated submission, success, and rejection recovery. Every declared state must render and identify itself before Axe scans it on desktop and mobile Chromium. A separate test injects a known violation and proves the gate fails closed. The verified-page audio recovery state remains part of the scan.

The harness does not exercise route loaders, OAuth, PostgreSQL, filesystem storage, paid providers, or network serialization; those boundaries remain covered by their server and service tests. The verification page image and extraction-empty shell are deterministic route context around the real verification controls. The capture adapter selects a fixture file but does not upload or extract its bytes. These limits do not replace audited controls with test copies: stateful and accessibility-relevant production controls are rendered directly.

The fixture server is test-only and is never included in the production TanStack build.
