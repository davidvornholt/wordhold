import { type ReactNode, useEffect, useRef } from 'react';

type ManagedStepHeadingProps = {
  readonly children: ReactNode;
  readonly className: string;
};

export const ManagedStepHeading = ({
  children,
  className,
}: ManagedStepHeadingProps) => {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const focusTask = globalThis.setTimeout(() => heading.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, []);

  return (
    <h2 className={className} ref={heading} tabIndex={-1}>
      {children}
    </h2>
  );
};
