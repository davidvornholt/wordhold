import { createLink } from '@tanstack/react-router';
import type { ComponentPropsWithRef } from 'react';

const backAnchorClass =
  'inline-flex min-h-11 w-fit items-center text-muted-foreground text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// The one way back. Every screen's upper-left return control renders through
// this component so label prefix, size, and focus treatment never drift.
export const BackLink = createLink(
  ({ children, ...props }: Omit<ComponentPropsWithRef<'a'>, 'className'>) => (
    <a {...props} className={backAnchorClass}>
      ← {children}
    </a>
  ),
);
