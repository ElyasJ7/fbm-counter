import { cn } from '../../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--color-brand)]',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
