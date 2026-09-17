import { cn } from '../../lib/cn';

export function Spinner({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-border border-t-brand',
        size === 'sm' && 'h-4 w-4',
        size === 'md' && 'h-5 w-5',
        size === 'lg' && 'h-8 w-8',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
