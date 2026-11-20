/*
 * Form field styling. text-base (16px) is deliberate: smaller input fonts
 * make mobile Safari zoom into the field on focus.
 */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// For fields sitting on the page background.
export const fieldClass = `min-h-11 border border-input bg-card px-3 py-2 text-base ${focusRing}`;

// The line on a practice or learning card that the answer is written on, the
// way a word is written on an index card: in the card's display face, on a
// rule that takes the focus color while it is written on. Writing the word is
// the whole act, so it is large. The type and spacing are kept apart from
// the field's own states, so a copy laid under the field can match it to the
// pixel.
export const answerLineType =
  'min-h-12 w-full border-b-2 pt-1 pb-1.5 font-display text-2xl leading-snug';

// A definition, a text or a sentence wraps, so it is written in the body
// face, which reads better at length, above a single rule that moves down
// as the answer grows.
export const answerPageType =
  'min-h-12 w-full border-b-2 pt-2 pb-2 text-lg leading-8';

export const answerFieldStates =
  'bg-transparent placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:text-foreground';

// For fields sitting on a card surface.
export const fieldOnCardClass = `min-h-11 border border-input bg-background px-3 py-2 text-base ${focusRing}`;

// For the ruled lines of the verification ledger: the field is the line it
// is written on, like an entry in a vocabulary notebook.
export const ledgerFieldClass = `min-h-10 w-full border-input border-b border-dotted bg-transparent px-1 py-2 text-base placeholder:text-muted-foreground hover:border-foreground/40 hover:border-solid disabled:text-muted-foreground ${focusRing}`;
