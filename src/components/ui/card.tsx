import * as React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('academic-card panel-flat rounded-2xl', className)} {...props} />
));
Card.displayName = 'Card';
export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} data-card-section="header" className={cn('p-5 md:p-6 border-b hairline', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';
export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('section-title', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';
export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('body-copy mt-1', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';
export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} data-card-section="content" className={cn('p-5 md:p-6', className)} {...props} />
));
CardContent.displayName = 'CardContent';
export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} data-card-section="footer" className={cn('p-5 md:p-6 border-t hairline', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';
