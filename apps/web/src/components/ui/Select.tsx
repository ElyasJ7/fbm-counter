import { cn } from '../../lib/cn';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export function Select({
  label,
  error,
  hint,
  id,
  className,
  options,
  placeholder,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  const hintId = hint && selectId ? `${selectId}-hint` : undefined;
  const errorId = error && selectId ? `${selectId}-error` : undefined;

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={selectId}>
      <span className="font-medium text-ink">{label}</span>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(' ') || undefined
        }
        className={cn(
          'field-control',
          error && 'field-control-error',
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="text-helper">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
