import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import { FixtureApp } from './fixture-app';

const root = document.querySelector('#root');

if (root === null) {
  throw new Error('The accessibility fixture root is unavailable.');
}

document.body.dataset.fixture =
  new URLSearchParams(location.search).get('state') ?? 'unknown';

createRoot(root).render(<FixtureApp />);
