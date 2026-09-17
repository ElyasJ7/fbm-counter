import { cn } from '../../lib/cn';

type FilterBarProps = {
  children: React.ReactNode;
  className?: string;
  /** Optional accessible name for the filter region */
  'aria-label'?: string;
};

/** Compact filter strip for list pages — stacks on narrow screens. */
export function FilterBar({
  children,
  className,
  'aria-label': ariaLabel = 'Filters',
}: FilterBarProps) {
  return (
    <div
      role="search"
      aria-label={ariaLabel}
      className={cn(
        'rounded-[var(--radius-lg)] border border-border bg-panel p-3 shadow-[var(--shadow-xs)] sm:p-4',
        className,
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}
