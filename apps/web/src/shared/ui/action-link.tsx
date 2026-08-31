import { createLink } from '@tanstack/react-router';
import type { ComponentPropsWithRef } from 'react';
import { type ActionVariant, actionClass } from './action-styles';

type ActionAnchorProps = ComponentPropsWithRef<'a'> & {
  readonly variant?: ActionVariant;
};

const ActionAnchor = ({
  variant = 'primary',
  className,
  ...props
}: ActionAnchorProps) => (
  <a {...props} className={actionClass(variant, className)} />
);

// A router link styled exactly like a Button, so links that act as buttons
// and real buttons are indistinguishable to the eye and to the keyboard.
export const ActionLink = createLink(ActionAnchor);
