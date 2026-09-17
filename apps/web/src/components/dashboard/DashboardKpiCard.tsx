import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

type DashboardKpiCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand' | 'info';
  emphasis?: 'primary' | 'secondary';
  to?: string;
  className?: string;
};

const toneIcon: Record<NonNullable<DashboardKpiCardProps['tone']>, string> = {
  default: 'bg-background text-muted',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  brand: 'bg-brand-soft text-brand',
  info: 'bg-info-soft text-info',
};

/**
 * Dashboard KPI card with primary/secondary emphasis and optional navigation.
 */
export function DashboardKpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  emphasis = 'primary',
  to,
  className,
}: DashboardKpiCardProps) {
  const body = (
    <>
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
      <div
        className={cn(
          'mt-2 tabular-money font-semibold tracking-tight text-ink',
          emphasis === 'primary' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl',
        )}
      >
        {value}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </>
  );

  const shellClass = cn(
    'rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-xs)]',
    emphasis === 'primary' ? 'p-4 sm:p-5' : 'bg-panel/80 p-3.5 sm:p-4',
    to &&
      'transition hover:border-border-strong hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cn('block', shellClass)}>
        {body}
      </Link>
    );
  }

  return <div className={shellClass}>{body}</div>;
}
