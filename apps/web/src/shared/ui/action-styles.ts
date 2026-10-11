/*
 * The single source for action styling. Every button and link-as-button in
 * the app composes these classes so weight, height, focus ring, and disabled
 * treatment stay identical everywhere.
 */
const base =
  'inline-flex items-center justify-center gap-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// Every action is a 44px touch target, except a link set inside fine print,
// which keeps the 24px minimum so it does not stretch its line.
const touchTarget = 'min-h-11';

const variants = {
  primary: `${touchTarget} bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50`,
  outline: `${touchTarget} border border-input px-4 py-2 underline-offset-4 hover:underline disabled:opacity-50`,
  destructive: `${touchTarget} border border-destructive px-4 py-2 font-medium text-destructive underline-offset-4 hover:underline disabled:opacity-50`,
  quiet: `${touchTarget} underline underline-offset-4 disabled:opacity-50`,
  'quiet-muted': `${touchTarget} text-muted-foreground underline underline-offset-4 disabled:opacity-50`,
  // A square, unlabelled glyph; callers give it an aria-label and a title.
  icon: `${touchTarget} min-w-11 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:hover:bg-transparent`,
  'fine-print':
    'min-h-6 text-muted-foreground text-xs underline underline-offset-4 disabled:opacity-50',
} as const;

export type ActionVariant = keyof typeof variants;

export const actionClass = (
  variant: ActionVariant,
  className?: string,
): string =>
  className === undefined
    ? `${base} ${variants[variant]}`
    : `${base} ${variants[variant]} ${className}`;
