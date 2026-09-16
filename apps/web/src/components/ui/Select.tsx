import { cn } from '../../lib/cn';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export function Select({
  label,
  error,
  id,
  className,
  options,
  placeholder,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={selectId}>
      <span className="font-medium text-[var(--color-ink)]">{label}</span>
      <select
        id={selectId}
        className={cn(
          'h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-[var(--color-ink)] shadow-sm',
          error && 'border-[var(--color-danger)]',
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
