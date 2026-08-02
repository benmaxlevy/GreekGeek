import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex min-h-11 w-full rounded-[var(--radius-md)] border border-border-subtle bg-surface-input px-3.5 py-2.5 text-base text-ink-100 transition-[border-color,box-shadow] duration-150',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink-100',
          'placeholder:text-ink-700',
          'hover:border-border-strong',
          'focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/[0.06] focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-white/[0.02] disabled:text-ink-700 disabled:border-white/[0.05] disabled:placeholder:text-ink-700/60',
          'aria-[invalid=true]:border-[color:var(--status-overdue)] aria-[invalid=true]:focus-visible:ring-[color:var(--status-overdue)]/50',
          'md:text-sm',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
