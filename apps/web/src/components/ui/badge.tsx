import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Paid / approved — white, restrained glow.
        default:
          "border-transparent bg-white/[0.12] text-ink-100 shadow-[0_0_6px_rgba(255,255,255,0.2)] hover:bg-white/[0.18]",
        // Pending / in-flight — muted ink, no fill.
        secondary: "border-transparent bg-white/[0.06] text-ink-300 hover:bg-white/[0.10]",
        // Overdue — the one red accent, with glow.
        destructive:
          "border-transparent bg-[color:var(--status-overdue-bg)] text-[color:var(--status-overdue)] shadow-[0_0_6px_rgba(229,84,75,0.35)] hover:brightness-110",
        outline: "border-border-strong text-ink-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
