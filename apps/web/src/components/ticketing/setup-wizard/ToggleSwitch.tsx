import { cn } from '@/lib/utils';
import type { ToggleSwitchProps } from './types';

export function ToggleSwitch({
  id,
  label,
  checked,
  onCheckedChange,
  className,
}: ToggleSwitchProps) {
  const labelId = `${id}-label`;

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span id={labelId} className="text-sm font-medium text-ink-200">
        {label}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        data-state={checked ? 'checked' : 'unchecked'}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          checked
            ? 'border-emerald-300 bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.28)]'
            : 'border-rose-300 bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.22)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none flex size-5 items-center justify-center rounded-full bg-white text-sm font-bold leading-none shadow-sm transition-transform duration-200',
            checked
              ? 'translate-x-5 text-emerald-600'
              : 'translate-x-0 text-rose-600',
          )}
        >
          {checked ? '✓' : '×'}
        </span>
      </button>
    </div>
  );
}
