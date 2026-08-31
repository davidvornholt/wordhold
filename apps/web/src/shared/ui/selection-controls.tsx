import type { ComponentPropsWithRef } from 'react';

// The native controls keep their semantics; only the drawing is replaced so
// both marks share the theme's square geometry. The check and the dot render
// as sibling marks because replaced inputs cannot carry pseudo-elements.
const boxClass =
  'peer size-5 appearance-none border border-input bg-card checked:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50';

// The wrapper is fixed to the box size so a stretching flex parent cannot
// pull the absolutely centered mark away from the box.
const wrapperClass = (className: string | undefined) =>
  className === undefined
    ? 'relative inline-flex size-5 shrink-0'
    : `relative inline-flex size-5 shrink-0 ${className}`;

type ControlProps = Omit<
  ComponentPropsWithRef<'input'>,
  'className' | 'type'
> & {
  readonly className?: string;
};

export const Checkbox = ({ className, ...props }: ControlProps) => (
  <span className={wrapperClass(className)}>
    <input
      {...props}
      className={`${boxClass} checked:bg-primary`}
      type="checkbox"
    />
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 m-auto hidden size-3.5 text-primary-foreground peer-checked:block peer-disabled:opacity-50"
      fill="none"
      viewBox="0 0 14 14"
    >
      <path d="M2 7.5 5.5 11 12 3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  </span>
);

export const RadioButton = ({ className, ...props }: ControlProps) => (
  <span className={wrapperClass(className)}>
    <input {...props} className={boxClass} type="radio" />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 m-auto hidden size-2.5 bg-primary peer-checked:block peer-disabled:opacity-50"
    />
  </span>
);
