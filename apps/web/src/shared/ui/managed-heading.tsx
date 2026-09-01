import { type ReactNode, useEffect, useRef } from 'react';

type ManagedHeadingProps = {
  readonly children: ReactNode;
  readonly className: string;
};

// Moves keyboard and screen-reader focus to the heading of a newly revealed
// step, so in-page transitions announce themselves like navigations. The
// timeout defers focus until the new subtree has settled.
export const ManagedHeading = ({
  children,
  className,
}: ManagedHeadingProps) => {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const focusTask = globalThis.setTimeout(() => heading.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, []);

  return (
    <h2
      className={`${className} focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2`}
      ref={heading}
      tabIndex={-1}
    >
      {children}
    </h2>
  );
};
