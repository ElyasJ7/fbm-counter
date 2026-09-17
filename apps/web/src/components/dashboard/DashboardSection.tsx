import { cn } from '../../lib/cn';

type DashboardSectionProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Accessible landmark label override */
  'aria-label'?: string;
};

/** Section shell for dashboard panels. */
export function DashboardSection({
  title,
  description,
  actions,
  children,
  className,
  'aria-label': ariaLabel,
}: DashboardSectionProps) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className={cn(
        'rounded-[var(--radius-lg)] border border-border bg-panel shadow-[var(--shadow-xs)]',
        className,
      )}
    >
      <header className="flex flex-col gap-2 border-b border-border px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-section-title">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
