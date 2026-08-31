/*
 * Form field styling. text-base (16px) is deliberate: smaller input fonts
 * make mobile Safari zoom into the field on focus.
 */
const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// For fields sitting on the page background.
export const fieldClass = `min-h-11 border border-input bg-card px-3 py-2 text-base ${focusRing}`;

// For fields sitting on a card surface.
export const fieldOnCardClass = `min-h-11 border border-input bg-background px-3 py-2 text-base ${focusRing}`;

// For dense rows in the verification workbench.
export const fieldCompactClass = `w-full border border-input bg-card px-2 py-1.5 text-base ${focusRing}`;
