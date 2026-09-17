import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

type AlertProps = {
  children: React.ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  className?: string;
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
};

const tones = {
  info: 'border-info/20 bg-info-soft text-info',
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-warning/20 bg-warning-soft text-warning',
  danger: 'border-danger/20 bg-danger-soft text-danger',
};

export function Alert({
  children,
  tone = 'info',
  title,
  className,
}: AlertProps) {
  const Icon = icons[tone];
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 text-sm',
        tones[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        <div className="text-ink/90">{children}</div>
      </div>
    </div>
  );
}
