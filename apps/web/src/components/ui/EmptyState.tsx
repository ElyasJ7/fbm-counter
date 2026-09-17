import { cn } from '../../lib/cn';
import { Button } from './Button';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-panel p-8',
        className,
      )}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-section-title">{title}</h3>
        <p className="max-w-xl text-sm text-muted">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
}
