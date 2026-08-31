/*
 * The single source for action styling. Every button and link-as-button in
 * the app composes these classes so weight, height, focus ring, and disabled
 * treatment stay identical everywhere.
 */
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const variants = {
  primary:
    'bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50',
  outline:
    'border border-input px-4 py-2 underline-offset-4 hover:underline disabled:opacity-50',
  destructive:
    'border border-destructive px-4 py-2 font-medium text-destructive underline-offset-4 hover:underline disabled:opacity-50',
  quiet: 'underline underline-offset-4 disabled:opacity-50',
  'quiet-muted':
    'text-muted-foreground underline underline-offset-4 disabled:opacity-50',
} as const;

export type ActionVariant = keyof typeof variants;

export const actionClass = (
  variant: ActionVariant,
  className?: string,
): string =>
  className === undefined
    ? `${base} ${variants[variant]}`
    : `${base} ${variants[variant]} ${className}`;
