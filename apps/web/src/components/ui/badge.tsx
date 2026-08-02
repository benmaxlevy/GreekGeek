import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, Check, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex h-6 items-center gap-[5px] rounded-full border px-2.5 text-[11.5px] font-semibold tracking-[0.01em] whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[color:var(--status-paid-bg)] text-[color:var(--status-paid)] hover:bg-white/[0.18]',
        paid: 'border-transparent bg-[color:var(--status-paid-bg)] text-[color:var(--status-paid)] hover:bg-white/[0.18]',
        secondary: 'border-transparent bg-white/[0.06] text-ink-300 hover:bg-white/[0.10]',
        pending:
          'border-transparent bg-[color:var(--status-pending-bg)] text-[color:var(--status-pending)] hover:bg-white/[0.10]',
        destructive:
          'border-transparent bg-[color:var(--status-overdue-bg)] text-[color:var(--status-overdue)] hover:brightness-110',
        overdue:
          'border-transparent bg-[color:var(--status-overdue-bg)] text-[color:var(--status-overdue)] hover:brightness-110',
        outline: 'border-border-strong text-ink-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const resolvedVariant = variant ?? 'default';
  const StatusIcon =
    resolvedVariant === 'destructive' || resolvedVariant === 'overdue'
      ? AlertCircle
      : resolvedVariant === 'secondary' || resolvedVariant === 'pending'
        ? Clock
        : resolvedVariant === 'default' || resolvedVariant === 'paid'
          ? Check
          : null;

  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {StatusIcon && <StatusIcon aria-hidden="true" size={11} strokeWidth={2.5} />}
      {props.children}
    </span>
  );
}

export { Badge, badgeVariants };
