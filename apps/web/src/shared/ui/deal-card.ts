import { flushSync } from 'react-dom';

// Whether a card is being dealt now. A second transition would cut the
// first short, so a card answered meanwhile simply appears.
let dealing = false;

const reducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

// Moves a practice or learning round on to its next card by dealing the
// answered one away: the update runs inside a view transition
// that marks the root with data-dealing, which styles.css animates. Where
// the browser has no view transitions, or motion is reduced, the next card
// simply replaces the last.
export const dealCard = (update: () => void): void => {
  if (
    dealing ||
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    reducedMotion()
  ) {
    update();
    return;
  }
  dealing = true;
  const root = document.documentElement;
  root.toggleAttribute('data-dealing', true);
  const transition = document.startViewTransition(() => {
    flushSync(update);
  });
  // A transition the browser skips, such as one a navigation interrupts,
  // rejects `ready`; the update has run all the same.
  transition.ready.catch(() => undefined);
  const settle = () => {
    dealing = false;
    root.toggleAttribute('data-dealing', false);
  };
  transition.finished.then(settle, settle);
};
