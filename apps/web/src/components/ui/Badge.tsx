import { cn } from '../../lib/cn';

type BadgeProps = {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'info';
  className?: string;
};

const tones: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-surface text-muted ring-1 ring-inset ring-border',
  success: 'bg-success-soft text-success ring-1 ring-inset ring-success/20',
  warning: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/25',
  danger: 'bg-danger-soft text-danger ring-1 ring-inset ring-danger/20',
  brand: 'bg-brand-soft text-brand ring-1 ring-inset ring-brand/20',
  info: 'bg-info-soft text-info ring-1 ring-inset ring-info/20',
};

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
