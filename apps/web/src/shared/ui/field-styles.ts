/*
 * Form field styling. text-base (16px) is deliberate: smaller input fonts
 * make mobile Safari zoom into the field on focus.
 */
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// For fields sitting on the page background.
export const fieldClass = `min-h-11 border border-input bg-card px-3 py-2 text-base ${focusRing}`;

// The one field of a practice or learning card: larger, because writing the
// word is the whole act. Callers add the border color for the tone.
export const answerFieldClass = `min-h-12 w-full border bg-card px-4 py-3 text-lg disabled:text-foreground ${focusRing}`;

// For fields sitting on a card surface.
export const fieldOnCardClass = `min-h-11 border border-input bg-background px-3 py-2 text-base ${focusRing}`;

// For dense rows in the verification workbench.
export const fieldCompactClass = `w-full border border-input bg-card px-2 py-1.5 text-base ${focusRing}`;
