import { cn } from '../../lib/cn';
import { formatCurrency } from '../../lib/format';

type CurrencyValueProps = {
  value: string | number;
  currency?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'success' | 'danger' | 'muted';
};

/** Formatted EUR (or other) amount with tabular figures. */
export function CurrencyValue({
  value,
  currency = 'EUR',
  className,
  size = 'md',
  tone = 'default',
}: CurrencyValueProps) {
  return (
    <span
      className={cn(
        'tabular-money font-semibold tracking-tight',
        size === 'sm' && 'text-sm',
        size === 'md' && 'text-base',
        size === 'lg' && 'text-xl',
        tone === 'default' && 'text-ink',
        tone === 'success' && 'text-success',
        tone === 'danger' && 'text-danger',
        tone === 'muted' && 'text-muted font-medium',
        className,
      )}
    >
      {formatCurrency(value, currency)}
    </span>
  );
}
