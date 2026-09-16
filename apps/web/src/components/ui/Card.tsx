import { cn } from '../../lib/cn';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
};

export function Card({ children, className, title, description }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-5',
        className,
      )}
    >
      {(title || description) && (
        <header className="mb-4">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
          {description ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}
