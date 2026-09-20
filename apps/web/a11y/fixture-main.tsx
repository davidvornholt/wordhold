import { createRoot } from 'react-dom/client';
import { FixtureApp } from './fixture-app';

const root = document.querySelector('#root');

if (root === null) {
  throw new Error('The accessibility fixture root is unavailable.');
}

document.body.dataset.fixture =
  new URLSearchParams(location.search).get('state') ?? 'unknown';

const strictModeOption = 'unstable_strictMode';
const rootOptions: Parameters<typeof createRoot>[1] &
  Readonly<Record<typeof strictModeOption, boolean>> = {
  // Audio playback must survive StrictMode's double-invoked effects, which
  // the real client entry runs in development.
  [strictModeOption]: ['learn-audio', 'practice-session'].includes(
    document.body.dataset.fixture ?? '',
  ),
};

createRoot(root, rootOptions).render(<FixtureApp />);
