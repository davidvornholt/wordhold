import type { ComponentProps } from 'react';
import { type ActionVariant, actionClass } from './action-styles';

type ButtonProps = ComponentProps<'button'> & {
  readonly variant?: ActionVariant;
};

export const Button = ({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) => (
  <button {...props} className={actionClass(variant, className)} type={type} />
);
