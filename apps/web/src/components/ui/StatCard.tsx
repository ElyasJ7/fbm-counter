import { cn } from '../../lib/cn';

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand' | 'info';
  className?: string;
};

const toneIcon: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-background text-muted',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  brand: 'bg-brand-soft text-brand',
  info: 'bg-info-soft text-info',
};

/**
 * Compact KPI / metric card for dashboards and financial summaries.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-border bg-panel p-4 shadow-[var(--shadow-xs)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-medium tracking-wide uppercase">
          {label}
        </p>
        {icon ? (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
              toneIcon[tone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 tabular-money text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {value}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
