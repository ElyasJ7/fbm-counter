import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
  roleHasPermission,
  type MoneyConversionResultDto,
  type SupportedCurrency,
} from '@fbm/shared';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';
import {
  formatRateLine,
  materialSubtotal,
  parseConverterAmount,
  quickAmountsFor,
  swapCurrencies,
} from '../lib/currency-converter';
import { formatCurrency } from '../lib/format';
import {
  convertMoney,
  fetchLatestExchangeRates,
  refreshExchangeRates,
} from '../services/exchange-rates';
import { fetchProjects } from '../services/projects';

const currencyOptions = SUPPORTED_CURRENCIES.map((code) => ({
  value: code,
  label: `${CURRENCY_SYMBOLS[code]} ${code} — ${CURRENCY_LABELS[code]}`,
}));

function formatUpdatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function ConversionResult({
  result,
  amountLabel,
}: {
  result: MoneyConversionResultDto | null | undefined;
  amountLabel?: string;
}) {
  if (!result) return null;

  if (result.status === 'unavailable') {
    return (
      <Alert tone="warning" title="Exchange rate currently unavailable.">
        No cached rate for {result.originalCurrency} → {result.convertedCurrency}.
        Refresh rates in Settings if you have permission, or enter a manual rate.
      </Alert>
    );
  }

  const converted = result.convertedAmount;
  if (converted == null) return null;

  const rateLine = formatRateLine(
    result.originalCurrency,
    result.convertedCurrency,
    result.exchangeRate,
  );
  const updated = formatUpdatedAt(result.fetchedAt ?? result.effectiveAt);

  return (
    <div className="rounded-[var(--radius-md)] bg-surface px-4 py-4">
      {amountLabel ? (
        <p className="text-caption mb-1 text-muted">{amountLabel}</p>
      ) : null}
      <p className="text-lg font-semibold tabular-nums text-ink sm:text-xl">
        {formatCurrency(result.originalAmount, result.originalCurrency)}
      </p>
      <p className="my-1 text-sm text-muted" aria-hidden>
        =
      </p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums text-brand sm:text-3xl">
        {formatCurrency(converted, result.convertedCurrency)}
      </p>
      {rateLine ? (
        <p className="mt-3 text-sm text-muted">{rateLine}</p>
      ) : null}
      {updated ? (
        <p className="text-caption text-subtle">Last updated: {updated}</p>
      ) : null}
    </div>
  );
}

export function CurrencyConverterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canRead = user
    ? roleHasPermission(user.role, 'finances:read')
    : false;
  const canRefresh = user
    ? user.role === 'ADMIN' || user.role === 'MANAGEMENT'
    : false;

  const [amount, setAmount] = useState('1000');
  const [fromCurrency, setFromCurrency] = useState<SupportedCurrency>('USD');
  const [toCurrency, setToCurrency] = useState<SupportedCurrency>('AFN');
  const [projectId, setProjectId] = useState('');

  const [salaryAmount, setSalaryAmount] = useState('800');
  const [salaryFrom, setSalaryFrom] = useState<SupportedCurrency>('USD');
  const [salaryTo, setSalaryTo] = useState<SupportedCurrency>('AFN');

  const [unitPrice, setUnitPrice] = useState('25');
  const [quantity, setQuantity] = useState('200');
  const [materialFrom, setMaterialFrom] = useState<SupportedCurrency>('USD');
  const [materialTo, setMaterialTo] = useState<SupportedCurrency>('AFN');

  const ratesQuery = useQuery({
    queryKey: ['exchange-rates', 'latest'],
    queryFn: fetchLatestExchangeRates,
    enabled: canRead,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'currency-converter'],
    queryFn: () => fetchProjects({ page: 1, pageSize: 100 }),
    enabled: canRead,
  });

  const amountParse = useMemo(() => {
    try {
      return { value: parseConverterAmount(amount), error: null as string | null };
    } catch (error) {
      return {
        value: null as string | null,
        error: error instanceof Error ? error.message : 'Invalid amount',
      };
    }
  }, [amount]);
  const parsedAmount = amountParse.value;
  const amountError = amountParse.error;

  const mainConvertQuery = useQuery({
    queryKey: ['exchange-rates', 'convert', parsedAmount, fromCurrency, toCurrency],
    queryFn: () =>
      convertMoney({
        amount: parsedAmount!,
        fromCurrency,
        toCurrency,
      }),
    enabled: canRead && parsedAmount != null,
  });

  const salaryParsed = useMemo(() => {
    try {
      return parseConverterAmount(salaryAmount);
    } catch {
      return null;
    }
  }, [salaryAmount]);

  const salaryQuery = useQuery({
    queryKey: [
      'exchange-rates',
      'convert',
      'salary',
      salaryParsed,
      salaryFrom,
      salaryTo,
    ],
    queryFn: () =>
      convertMoney({
        amount: salaryParsed!,
        fromCurrency: salaryFrom,
        toCurrency: salaryTo,
      }),
    enabled: canRead && salaryParsed != null,
  });

  const materialParse = useMemo(() => {
    try {
      return {
        value: materialSubtotal(unitPrice, quantity),
        error: null as string | null,
      };
    } catch (error) {
      return {
        value: null as string | null,
        error:
          error instanceof Error ? error.message : 'Invalid material amounts',
      };
    }
  }, [unitPrice, quantity]);
  const materialParsed = materialParse.value;
  const materialError = materialParse.error;

  const materialQuery = useQuery({
    queryKey: [
      'exchange-rates',
      'convert',
      'material',
      materialParsed,
      materialFrom,
      materialTo,
    ],
    queryFn: () =>
      convertMoney({
        amount: materialParsed!,
        fromCurrency: materialFrom,
        toCurrency: materialTo,
      }),
    enabled: canRead && materialParsed != null,
  });

  const refreshMutation = useMutation({
    mutationFn: refreshExchangeRates,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
    },
  });

  useEffect(() => {
    if (!projectId || !projectsQuery.data?.data) return;
    const project = projectsQuery.data.data.find((p) => p.id === projectId);
    if (!project?.currency) return;
    const code = project.currency.toUpperCase();
    if ((SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
      setToCurrency(code as SupportedCurrency);
    }
  }, [projectId, projectsQuery.data]);

  const quickAmounts = quickAmountsFor(fromCurrency);

  const usdAfnQuery = useQuery({
    queryKey: ['exchange-rates', 'convert', 'panel', 'USD', 'AFN'],
    queryFn: () =>
      convertMoney({ amount: '1', fromCurrency: 'USD', toCurrency: 'AFN' }),
    enabled: canRead,
  });
  const eurAfnQuery = useQuery({
    queryKey: ['exchange-rates', 'convert', 'panel', 'EUR', 'AFN'],
    queryFn: () =>
      convertMoney({ amount: '1', fromCurrency: 'EUR', toCurrency: 'AFN' }),
    enabled: canRead,
  });
  const usdEurQuery = useQuery({
    queryKey: ['exchange-rates', 'convert', 'panel', 'USD', 'EUR'],
    queryFn: () =>
      convertMoney({ amount: '1', fromCurrency: 'USD', toCurrency: 'EUR' }),
    enabled: canRead,
  });

  const ratePairs = [
    { from: 'USD' as const, to: 'AFN' as const, result: usdAfnQuery.data },
    { from: 'EUR' as const, to: 'AFN' as const, result: eurAfnQuery.data },
    { from: 'USD' as const, to: 'EUR' as const, result: usdEurQuery.data },
  ];

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Currency Converter"
          description="Convert amounts using cached exchange rates."
        />
        <Alert tone="warning" title="Access restricted">
          You need finances read permission to use the converter.
        </Alert>
      </div>
    );
  }

  function onSwap() {
    const next = swapCurrencies(fromCurrency, toCurrency);
    setFromCurrency(next.from);
    setToCurrency(next.to);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Currency Converter"
        description="Convert USD, AFN, and EUR using your company's cached exchange rates. Calculator only — nothing is written to the books."
        actions={
          canRefresh ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                refreshMutation.isPending ||
                ratesQuery.data?.providerConfigured === false
              }
              onClick={() => refreshMutation.mutate()}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {refreshMutation.isPending ? 'Refreshing…' : 'Refresh rates'}
            </Button>
          ) : null
        }
      />

      {refreshMutation.isError ? (
        <Alert tone="danger" title="Could not refresh rates">
          {refreshMutation.error instanceof ApiError
            ? refreshMutation.error.message
            : 'Unexpected error'}
        </Alert>
      ) : null}
      {refreshMutation.isSuccess ? (
        <Alert tone="success" title="Rates refreshed">
          Latest provider rates are now cached for conversion.
        </Alert>
      ) : null}

      <Card
        title="Convert"
        description="Enter an amount, choose currencies, and read the result from the live rate cache."
      >
        <div className="grid gap-4">
          <Input
            label="Amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            error={amountError ?? undefined}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg"
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Select
              label="From currency"
              name="fromCurrency"
              value={fromCurrency}
              options={currencyOptions}
              onChange={(e) =>
                setFromCurrency(e.target.value as SupportedCurrency)
              }
            />
            <div className="flex justify-center pb-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Swap currencies"
                onClick={onSwap}
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden />
                Swap
              </Button>
            </div>
            <Select
              label="To currency"
              name="toCurrency"
              value={toCurrency}
              options={currencyOptions}
              onChange={(e) =>
                setToCurrency(e.target.value as SupportedCurrency)
              }
            />
          </div>

          <Select
            label="Project (optional)"
            name="projectId"
            value={projectId}
            placeholder="No project — keep current target"
            options={(projectsQuery.data?.data ?? []).map((p) => ({
              value: p.id,
              label: `${p.projectNumber} · ${p.name} (${p.currency})`,
            }))}
            onChange={(e) => setProjectId(e.target.value)}
            hint="Selecting a project sets the target currency to the project currency."
          />

          {mainConvertQuery.isLoading ? (
            <p className="text-sm text-muted">Converting…</p>
          ) : null}
          {mainConvertQuery.isError ? (
            <Alert tone="danger" title="Conversion failed">
              {mainConvertQuery.error instanceof ApiError
                ? mainConvertQuery.error.message
                : 'Unexpected error'}
            </Alert>
          ) : (
            <ConversionResult result={mainConvertQuery.data} />
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Quick conversions"
          description={`Tap a common ${fromCurrency} amount to convert to ${toCurrency}.`}
        >
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setAmount(value)}
              >
                {formatCurrency(value, fromCurrency)}
              </Button>
            ))}
          </div>
        </Card>

        <Card
          title="Current exchange rates"
          description={
            ratesQuery.data?.lastUpdatedAt
              ? `Last updated ${formatUpdatedAt(ratesQuery.data.lastUpdatedAt)}`
              : 'From the company rate cache'
          }
        >
          {ratesQuery.isLoading ||
          usdAfnQuery.isLoading ||
          eurAfnQuery.isLoading ? (
            <p className="text-sm text-muted">Loading rates…</p>
          ) : (
            <ul className="space-y-3">
              {ratePairs.map((pair) => {
                const rate =
                  pair.result?.status === 'unavailable'
                    ? null
                    : pair.result?.exchangeRate;
                return (
                  <li
                    key={`${pair.from}-${pair.to}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-sm font-medium text-ink">
                      {pair.from} → {pair.to}
                    </span>
                    <span className="tabular-nums text-sm text-muted">
                      {rate
                        ? `1 ${pair.from} = ${CURRENCY_SYMBOLS[pair.to]}${rate}`
                        : 'Unavailable'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Salary conversion"
          description="Informational only — does not create payroll or payments."
        >
          <div className="grid gap-3">
            <Input
              label="Salary amount"
              name="salaryAmount"
              inputMode="decimal"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Salary currency"
                name="salaryFrom"
                value={salaryFrom}
                options={currencyOptions}
                onChange={(e) =>
                  setSalaryFrom(e.target.value as SupportedCurrency)
                }
              />
              <Select
                label="Pay in"
                name="salaryTo"
                value={salaryTo}
                options={currencyOptions}
                onChange={(e) =>
                  setSalaryTo(e.target.value as SupportedCurrency)
                }
              />
            </div>
            <ConversionResult
              result={salaryQuery.data}
              amountLabel="Pay employee"
            />
          </div>
        </Card>

        <Card
          title="Material cost conversion"
          description="Informational only — does not create expenses or invoices."
        >
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Unit price"
                name="unitPrice"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
              <Input
                label="Quantity"
                name="quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Price currency"
                name="materialFrom"
                value={materialFrom}
                options={currencyOptions}
                onChange={(e) =>
                  setMaterialFrom(e.target.value as SupportedCurrency)
                }
              />
              <Select
                label="Convert to"
                name="materialTo"
                value={materialTo}
                options={currencyOptions}
                onChange={(e) =>
                  setMaterialTo(e.target.value as SupportedCurrency)
                }
              />
            </div>
            {materialError ? (
              <Alert tone="danger" title="Invalid input">
                {materialError}
              </Alert>
            ) : null}
            {materialParsed ? (
              <p className="text-sm text-muted">
                Subtotal:{' '}
                <span className="font-medium tabular-nums text-ink">
                  {formatCurrency(materialParsed, materialFrom)}
                </span>
              </p>
            ) : null}
            <ConversionResult
              result={materialQuery.data}
              amountLabel="Equivalent"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
