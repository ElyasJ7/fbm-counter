import { cn } from '../../lib/cn';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg' | 'none';
};

const paddingMap = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export function Card({
  children,
  className,
  title,
  description,
  actions,
  padding = 'md',
}: CardProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-xs)]',
        paddingMap[padding],
        className,
      )}
    >
      {(title || description || actions) && (
        <header
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between',
            padding !== 'none' && 'mb-4',
            padding === 'none' && 'mb-0 border-b border-border px-5 py-4',
          )}
        >
          <div className="min-w-0">
            {title ? <h2 className="text-section-title">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-sm text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}
