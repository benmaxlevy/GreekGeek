import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Black-chrome hardware — the default action. Gradient/shadow recipe lives in
        // the .btn-chrome utility (styles.css) to match the design handoff exactly.
        default: "btn-chrome text-ink-100",
        // Rounded-full white pill — marketing CTAs only (e.g. "Book a demo"), never used
        // for in-app actions.
        pill: "btn-chrome text-ink-100 rounded-full",
        destructive:
          "bg-[color:var(--status-overdue)] text-white shadow-sm hover:brightness-110 active:brightness-95 disabled:shadow-none",
        outline:
          "border border-border-strong bg-transparent text-ink-100 hover:bg-surface-input hover:border-border-accent active:bg-white/10",
        secondary:
          "border border-border-strong bg-transparent text-ink-100 hover:bg-surface-input hover:border-border-accent active:bg-white/10",
        ghost: "text-ink-300 hover:text-ink-100 hover:bg-surface-input active:bg-white/10",
        // Frosted translucent — floating controls over imagery/nav bars.
        glass:
          "bg-surface-glass backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.16] text-ink-100 shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-surface-glass-strong hover:border-border-accent",
        link: "text-ink-100 underline-offset-4 hover:underline disabled:no-underline",
      },
      size: {
        // 44px minimum tap target for chapter-facing UI (rally-design hard rule).
        default: "h-11 px-5 py-2",
        // sm stays compact for dense admin/desktop consoles only.
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
    const Comp = asChild ? Slot : "button";
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
Button.displayName = "Button";

export { Button, buttonVariants };
