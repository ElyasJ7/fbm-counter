import { cn } from '../../lib/cn';

type ProgressBarProps = {
  value: number;
  className?: string;
  showLabel?: boolean;
  tone?: 'brand' | 'warning' | 'danger' | 'success';
};

const toneFill: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  brand: 'bg-brand',
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
};

/** Subtle progress indicator (0–100). */
export function ProgressBar({
  value,
  className,
  showLabel = true,
  tone = 'brand',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn('flex min-w-[6rem] items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            toneFill[tone],
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel ? (
        <span className="tabular-money w-8 text-right text-xs text-muted">
          {Math.round(clamped)}%
        </span>
      ) : null}
    </div>
  );
}
