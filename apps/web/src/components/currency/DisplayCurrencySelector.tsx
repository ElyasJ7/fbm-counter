import { useState } from 'react';
import {
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '@fbm/shared';
import { useDisplayCurrency } from '../../hooks/useDisplayCurrency';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';

const options = SUPPORTED_CURRENCIES.map((code) => ({
  value: code,
  label: `${CURRENCY_SYMBOLS[code]} ${code}`,
  title: CURRENCY_LABELS[code],
}));

type DisplayCurrencySelectorProps = {
  className?: string;
  compact?: boolean;
};

export function DisplayCurrencySelector({
  className,
  compact = true,
}: DisplayCurrencySelectorProps) {
  const { displayCurrency, setDisplayCurrency, isSaving } =
    useDisplayCurrency();
  const [error, setError] = useState<string | null>(null);

  return (
    <label
      className={cn(
        'relative flex items-center gap-1.5 text-xs text-muted',
        className,
      )}
      title={error ?? undefined}
    >
      <span className={cn(compact && 'sr-only')}>Display currency</span>
      <select
        aria-label="Display currency"
        aria-invalid={error ? true : undefined}
        disabled={isSaving}
        value={displayCurrency}
        onChange={(event) => {
          const next = event.target.value as SupportedCurrency;
          setError(null);
          void setDisplayCurrency(next).catch((err: unknown) => {
            setError(
              err instanceof ApiError
                ? err.message
                : 'Could not update display currency',
            );
          });
        }}
        className={cn(
          'field-control h-8 min-w-[4.5rem] py-1 text-xs font-medium text-ink',
          compact && 'w-auto px-2',
          error && 'field-control-error',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} title={option.title}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
