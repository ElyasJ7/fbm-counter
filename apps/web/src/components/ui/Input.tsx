import { cn } from '../../lib/cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Input({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const hintId = hint && inputId ? `${inputId}-hint` : undefined;
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={inputId}>
      <span className="font-medium text-ink">{label}</span>
      <input
        id={inputId}
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
      />
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
