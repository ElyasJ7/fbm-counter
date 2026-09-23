import { CURRENCY_SYMBOLS, type SupportedCurrency } from '@fbm/shared';
import { cn } from '../../lib/cn';

export type FxIndicatorMeta = {
  status: 'converted' | 'identity' | 'unavailable';
  baseCurrency: string;
  displayCurrency: string;
  exchangeRate: string | null;
  effectiveAt: string | null;
  fetchedAt: string | null;
  provider: string | null;
};

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function symbolFor(code: string): string {
  if (code in CURRENCY_SYMBOLS) {
    return CURRENCY_SYMBOLS[code as SupportedCurrency];
  }
  return code;
}

type FxRateIndicatorProps = {
  fx: FxIndicatorMeta;
  className?: string;
};

/**
 * Compact FX strip for dashboard / reporting surfaces.
 * Shows one rate line, not per-card clutter.
 */
export function FxRateIndicator({ fx, className }: FxRateIndicatorProps) {
  if (fx.status === 'identity') {
    return (
      <p className={cn('text-caption text-subtle', className)}>
        Showing amounts in {fx.displayCurrency} (books currency).
      </p>
    );
  }

  if (fx.status === 'unavailable') {
    return (
      <p className={cn('text-caption text-warning', className)} role="status">
        Exchange rate {fx.baseCurrency}→{fx.displayCurrency} unavailable —
        showing {fx.baseCurrency} (books).
      </p>
    );
  }

  const rate = fx.exchangeRate;
  const updated = formatRelative(fx.fetchedAt ?? fx.effectiveAt);
  const fromSym = symbolFor(fx.baseCurrency);
  const toSym = symbolFor(fx.displayCurrency);

  return (
    <p className={cn('text-caption text-subtle', className)} role="status">
      <span className="font-medium text-muted">
        1 {fx.baseCurrency} = {toSym}
        {rate} {fx.displayCurrency}
      </span>
      {updated ? <span> · Updated {updated}</span> : null}
      <span className="sr-only">
        {' '}
        ({fromSym} to {toSym})
      </span>
    </p>
  );
}
