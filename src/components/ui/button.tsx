import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

const styles = (variant: ButtonProps['variant'], size: ButtonProps['size']) => cn(
  'ui-button focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background,color,border,transform,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-45',
  variant === 'default' && 'brand-bg border border-transparent hover:opacity-90',
  variant === 'outline' && 'border hairline bg-transparent hover:bg-[var(--panel-2)]',
  variant === 'ghost' && 'border border-transparent bg-transparent hover:bg-[var(--panel-2)]',
  variant === 'secondary' && 'border border-transparent brand-soft-bg hover:opacity-90',
  variant === 'danger' && 'border border-transparent bg-[var(--danger)] text-white hover:opacity-90',
  size === 'sm' && 'min-h-11 px-3 text-xs',
  size === 'default' && 'h-11 px-4 text-sm',
  size === 'lg' && 'h-12 px-5 text-sm',
  size === 'icon' && 'h-11 w-11 p-0',
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'default', asChild = false, children, ...props }, ref
) {
  const classNames = cn(styles(variant as NonNullable<ButtonProps['variant']>, size as NonNullable<ButtonProps['size']>), className);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      className: cn(classNames, (children as React.ReactElement<any>).props.className),
      'data-variant': variant,
      'data-size': size,
      ...props,
    });
  }
  return <button ref={ref} className={classNames} data-variant={variant} data-size={size} {...props}>{children}</button>;
});
