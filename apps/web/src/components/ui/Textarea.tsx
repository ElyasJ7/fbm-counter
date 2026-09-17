import { cn } from '../../lib/cn';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Textarea({
  label,
  error,
  hint,
  id,
  className,
  rows = 4,
  ...props
}: TextareaProps) {
  const areaId = id ?? props.name;
  const hintId = hint && areaId ? `${areaId}-hint` : undefined;
  const errorId = error && areaId ? `${areaId}-error` : undefined;

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm" htmlFor={areaId}>
      <span className="font-medium text-ink">{label}</span>
      <textarea
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(' ') || undefined
        }
        className={cn(
          'field-control min-h-[5.5rem] py-2.5 leading-relaxed',
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
