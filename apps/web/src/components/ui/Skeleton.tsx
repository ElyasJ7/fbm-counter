import { cn } from '../../lib/cn';

type SkeletonProps = {
  className?: string;
};

/** Lightweight placeholder block for page loading states. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-md)] bg-border/70',
        className,
      )}
      aria-hidden
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-border bg-panel p-5 shadow-[var(--shadow-xs)]',
        className,
      )}
    >
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}
