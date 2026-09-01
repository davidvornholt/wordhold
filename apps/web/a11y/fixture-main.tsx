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
  [strictModeOption]: document.body.dataset.fixture === 'learn-audio',
};

createRoot(root, rootOptions).render(<FixtureApp />);
