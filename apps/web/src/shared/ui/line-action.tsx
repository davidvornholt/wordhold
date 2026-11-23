import { SparklesIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button';

type LineActionProps = Omit<ComponentProps<'button'>, 'className'> & {
  // Top for a line that grows, such as a definition; centred otherwise.
  readonly align?: 'center' | 'start';
};

// What AI can write on an empty line, offered at the line's end: "Vorschlagen"
// on a word, "Beispielsatz erzeugen" on a sentence. It goes once the line is
// written on.
export const LineAction = ({
  align = 'center',
  children,
  ...props
}: LineActionProps) => (
  <Button
    {...props}
    className={`justify-self-end ${align === 'center' ? 'self-center' : 'self-start'}`}
    variant="text"
  >
    <SparklesIcon aria-hidden={true} className="size-4" />
    {children}
  </Button>
);

// A line and the action offered on it, in one grid cell, so the action takes
// no room of its own and nothing on the card moves when it comes or goes.
export const LineWithAction = ({
  line,
  action,
}: {
  readonly line: ReactNode;
  readonly action: ReactNode;
}) => (
  <div className="grid *:col-start-1 *:row-start-1">
    {line}
    {action}
  </div>
);
