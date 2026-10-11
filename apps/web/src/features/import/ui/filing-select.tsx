import { ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { focusRing } from '../../../shared/ui/field-styles';

// Where the page's words are filed, book and unit, set in the display face
// like the heading of a notebook page.
const filingFieldClass = `min-h-11 w-full border-input border-b bg-transparent py-1 pl-1 font-display text-xl placeholder:text-muted-foreground hover:border-foreground/40 disabled:text-muted-foreground ${focusRing}`;

export const FilingSelect = (props: ComponentProps<'select'>) => (
  <div className="relative">
    <select
      {...props}
      className={`${filingFieldClass} appearance-none truncate pr-8`}
    />
    <ChevronDownIcon
      aria-hidden={true}
      className="pointer-events-none absolute top-1/2 right-1 size-5 -translate-y-1/2 text-muted-foreground"
    />
  </div>
);

// The name of a book or unit this page starts.
export const FilingInput = (props: ComponentProps<'input'>) => (
  <input {...props} className={`${filingFieldClass} pr-1`} />
);
