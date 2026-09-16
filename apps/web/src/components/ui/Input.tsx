import { cn } from '../../lib/cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={inputId}>
      <span className="font-medium text-[var(--color-ink)]">{label}</span>
      <input
        id={inputId}
        className={cn(
          'h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-[var(--color-ink)] shadow-sm placeholder:text-slate-400',
          error && 'border-[var(--color-danger)]',
          className,
        )}
        {...props}
      />
      {error ? (
        <span className="text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
