import { cn } from '../../lib/cn';

type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2;
};

/**
 * Groups related form fields with a clear section heading.
 * Desktop defaults to 2 columns for field grids.
 */
export function FormSection({
  title,
  description,
  children,
  className,
  columns = 2,
}: FormSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <header className="border-b border-border pb-3">
        <h3 className="text-card-title">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </header>
      <div
        className={cn(
          'grid gap-4',
          columns === 2 && 'md:grid-cols-2',
          columns === 1 && 'grid-cols-1',
        )}
      >
        {children}
      </div>
    </section>
  );
}
