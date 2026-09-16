import { Button } from './Button';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8">
      <h3 className="text-base font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="max-w-xl text-sm text-[var(--color-muted)]">{description}</p>
      {actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
}
