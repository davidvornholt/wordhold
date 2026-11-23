import { flushSync } from 'react-dom';

// Whether a card is moving now. A second transition would cut the first
// short, so a card changed meanwhile simply changes.
let moving = false;

const reducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

// The attribute a card transition marks the root with, which styles.css
// animates, and its value before and after the update.
type CardMotion = {
  readonly attribute: string;
  readonly before: string;
  readonly after: string;
};

// Runs the update inside a view transition that marks the root while it
// runs. Where the browser has no view transitions, or motion is reduced,
// the update simply runs.
const moveCard = (motion: CardMotion, update: () => void): void => {
  if (
    moving ||
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    reducedMotion()
  ) {
    update();
    return;
  }
  moving = true;
  const root = document.documentElement;
  root.setAttribute(motion.attribute, motion.before);
  const transition = document.startViewTransition(() => {
    root.setAttribute(motion.attribute, motion.after);
    flushSync(update);
  });
  // A transition the browser skips, such as one a navigation interrupts,
  // rejects `ready`; the update has run all the same.
  transition.ready.catch(() => undefined);
  const settle = () => {
    moving = false;
    root.removeAttribute(motion.attribute);
  };
  transition.finished.then(settle, settle);
};

// Moves a practice or learning round on to its next card by dealing the
// answered one away.
export const dealCard = (update: () => void): void =>
  moveCard({ attribute: 'data-dealing', before: '', after: '' }, update);

// Files a typed entry: the card it was written on closes up into the newest
// row of the list below it, and a blank card takes its place. The card
// carries the shared name before the update and the row after it.
export const fileCard = (update: () => void): void =>
  moveCard({ attribute: 'data-filing', before: 'card', after: 'row' }, update);
