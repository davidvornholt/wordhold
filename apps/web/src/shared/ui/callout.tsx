import type { ComponentProps } from 'react';

/*
 * Edge-marked panels encode state with a border-l-4 edge plus text, never
 * color alone: positive for correct/success, warning for uncertainty,
 * destructive for wrong answers and failures, neutral for asides.
 */
const tones = {
  positive: 'border-primary bg-accent',
  warning: 'border-warning-foreground bg-warning',
  destructive: 'border-destructive bg-destructive/10',
  neutral: 'border-foreground/30 bg-card/50',
} as const;

type CalloutProps = ComponentProps<'div'> & {
  readonly tone: keyof typeof tones;
};

export const Callout = ({ tone, className, ...props }: CalloutProps) => (
  <div
    {...props}
    className={
      className === undefined
        ? `flex flex-col gap-3 border-l-4 p-4 ${tones[tone]}`
        : `flex flex-col gap-3 border-l-4 p-4 ${tones[tone]} ${className}`
    }
  />
);
