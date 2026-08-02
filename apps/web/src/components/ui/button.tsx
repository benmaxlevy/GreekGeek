import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.005em] cursor-pointer transition-[background,border-color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // White primary action from the mockup handoff.
        default: 'border border-white bg-white text-black hover:bg-[#e9e9e9]',
        primary: 'border border-white bg-white text-black hover:bg-[#e9e9e9]',
        chrome: 'btn-chrome text-ink-100',
        pill: 'btn-chrome text-ink-100 rounded-full',
        danger:
          'border border-[rgba(229,84,75,0.4)] bg-[color:var(--status-overdue-bg)] text-[color:var(--status-overdue)] hover:brightness-110',
        destructive:
          'border border-[rgba(229,84,75,0.4)] bg-[color:var(--status-overdue-bg)] text-[color:var(--status-overdue)] hover:brightness-110',
        outline:
          'border border-border-strong bg-transparent text-ink-100 hover:border-border-accent hover:bg-white/[0.04]',
        secondary:
          'border border-border-strong bg-transparent text-ink-100 hover:border-border-accent hover:bg-white/[0.04]',
        ghost: 'border border-border-strong bg-white/[0.04] text-ink-100 hover:bg-white/[0.08]',
        quiet:
          'border border-transparent bg-transparent text-ink-300 hover:bg-white/[0.04] hover:text-ink-100',
        glass:
          'bg-surface-glass backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.16] text-ink-100 shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-surface-glass-strong hover:border-border-accent',
        link: 'text-ink-100 underline-offset-4 hover:underline disabled:no-underline',
      },
      size: {
        // 44px minimum tap target for chapter-facing UI (rally-design hard rule).
        default: 'h-11 px-[18px] py-2',
        sm: 'h-[34px] rounded-md px-3 text-[13px]',
        lg: 'h-[52px] rounded-full px-7 text-[15px]',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        data-loading={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
