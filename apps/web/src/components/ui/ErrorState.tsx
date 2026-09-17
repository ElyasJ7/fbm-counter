import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { cn } from '../../lib/cn';

type ErrorStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTo?: string;
  className?: string;
};

/** Professional error / 403 / 404 style empty state. */
export function ErrorState({
  title,
  description,
  actionLabel,
  onAction,
  actionTo,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-danger/20 bg-danger-soft/40 p-6 sm:p-8',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-danger-soft text-danger">
        <AlertCircle className="h-5 w-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-section-title">{title}</h2>
        <p className="max-w-xl text-sm text-muted">{description}</p>
      </div>
      {actionLabel && actionTo ? (
        <Link to={actionTo}>
          <Button variant="secondary">{actionLabel}</Button>
        </Link>
      ) : null}
      {actionLabel && onAction && !actionTo ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
