import { type ReactNode, useEffect, useRef } from 'react';

type ManagedFocusHeadingProps = {
  readonly children: ReactNode;
  readonly className: string;
};

export const ManagedFocusHeading = ({
  children,
  className,
}: ManagedFocusHeadingProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <h2 className={className} ref={headingRef} tabIndex={-1}>
      {children}
    </h2>
  );
};
