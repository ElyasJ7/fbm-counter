import { cn } from '../../lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-[var(--color-brand)] text-white hover:bg-[#0c3d4a]',
        variant === 'secondary' &&
          'border border-[var(--color-border)] bg-white text-[var(--color-ink)] hover:bg-slate-50',
        variant === 'ghost' && 'text-[var(--color-ink)] hover:bg-slate-100',
        variant === 'danger' && 'bg-[var(--color-danger)] text-white hover:bg-red-800',
        className,
      )}
      {...props}
    />
  );
}
