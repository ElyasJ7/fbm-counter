import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExchangeRateSource, Prisma } from '@prisma/client';
import {
  assertSupportedCurrency,
  SUPPORTED_CURRENCIES,
  type ExchangeRateDto,
  type ExchangeRatesLatestDto,
} from '@fbm/shared';
import { crossRateFromPivot, money } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import {
  EXCHANGE_RATE_PROVIDER,
  type ExchangeRateProvider,
} from './providers/exchange-rate.provider';

const FX_REFRESH_LOCK_KEY = 920145601;

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXCHANGE_RATE_PROVIDER)
    private readonly provider: ExchangeRateProvider,
  ) {}

  private serialize(row: {
    id: string;
    baseCurrency: string;
    quoteCurrency: string;
    rate: Prisma.Decimal;
    provider: string;
    source: ExchangeRateSource;
    effectiveAt: Date;
    fetchedAt: Date;
    reason: string | null;
    createdById: string | null;
    createdAt: Date;
  }): ExchangeRateDto {
    return {
      id: row.id,
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rate: row.rate.toFixed(),
      provider: row.provider,
      source: row.source,
      effectiveAt: row.effectiveAt.toISOString(),
      fetchedAt: row.fetchedAt.toISOString(),
      reason: row.reason,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
    };
  }

  isProviderConfigured(): boolean {
    return this.provider.isConfigured();
  }

  async listLatest(): Promise<ExchangeRatesLatestDto> {
    const rates: ExchangeRateDto[] = [];
    let lastUpdatedAt: string | null = null;

    for (const base of SUPPORTED_CURRENCIES) {
      for (const quote of SUPPORTED_CURRENCIES) {
        if (base === quote) continue;
        const row = await this.prisma.exchangeRate.findFirst({
          where: { baseCurrency: base, quoteCurrency: quote },
          orderBy: [{ effectiveAt: 'desc' }, { fetchedAt: 'desc' }],
        });
        if (row) {
          rates.push(this.serialize(row));
          const stamp = row.fetchedAt.toISOString();
          if (!lastUpdatedAt || stamp > lastUpdatedAt) {
            lastUpdatedAt = stamp;
          }
        }
      }
    }

    return {
      rates,
      lastUpdatedAt,
      providerConfigured: this.isProviderConfigured(),
    };
  }

  /**
   * Resolve a stored rate for a pair. Never invents a rate.
   * - Prefer direct base→quote
   * - Else invert quote→base when available
   * - Optional asOf: rate with effectiveAt <= asOf (historical / accounting)
   */
  async resolveRate(input: {
    baseCurrency: string;
    quoteCurrency: string;
    asOf?: Date | string | null;
  }): Promise<ExchangeRateDto | null> {
    const base = assertSupportedCurrency(input.baseCurrency);
    const quote = assertSupportedCurrency(input.quoteCurrency);
    if (base === quote) {
      const now = new Date().toISOString();
      return {
        id: 'identity',
        baseCurrency: base,
        quoteCurrency: quote,
        rate: '1',
        provider: 'identity',
        source: 'PROVIDER',
        effectiveAt: now,
        fetchedAt: now,
        reason: null,
        createdById: null,
        createdAt: now,
      };
    }

    const asOf =
      input.asOf == null || input.asOf === ''
        ? null
        : input.asOf instanceof Date
          ? input.asOf
          : new Date(input.asOf);

    const effectiveFilter =
      asOf && !Number.isNaN(asOf.getTime())
        ? { effectiveAt: { lte: asOf } }
        : {};

    const direct = await this.prisma.exchangeRate.findFirst({
      where: { baseCurrency: base, quoteCurrency: quote, ...effectiveFilter },
      orderBy: [{ effectiveAt: 'desc' }, { fetchedAt: 'desc' }],
    });
    if (direct) return this.serialize(direct);

    const inverse = await this.prisma.exchangeRate.findFirst({
      where: { baseCurrency: quote, quoteCurrency: base, ...effectiveFilter },
      orderBy: [{ effectiveAt: 'desc' }, { fetchedAt: 'desc' }],
    });
    if (!inverse) return null;

    const inverted = money(1).div(money(inverse.rate.toFixed()));
    return {
      ...this.serialize(inverse),
      id: `${inverse.id}:inverted`,
      baseCurrency: base,
      quoteCurrency: quote,
      rate: inverted.toDecimalPlaces(8).toFixed(),
      reason: inverse.reason
        ? `${inverse.reason} (inverted)`
        : 'Inverted from reverse pair',
    };
  }

  /** @deprecated Prefer resolveRate — kept for call-site clarity. */
  async getLatestRate(
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<ExchangeRateDto | null> {
    return this.resolveRate({ baseCurrency, quoteCurrency });
  }

  async refreshFromProvider(actorId?: string): Promise<ExchangeRatesLatestDto> {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException(
        'FX provider is not configured (set FX_PROVIDER and FX_API_KEY)',
      );
    }

    let fetched;
    try {
      fetched = await this.provider.fetchLatest(SUPPORTED_CURRENCIES);
    } catch (error) {
      this.logger.error(
        `FX provider refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'FX provider temporarily unavailable; existing cached rates were kept',
      );
    }

    const pairs: Prisma.ExchangeRateCreateManyInput[] = [];
    for (const base of SUPPORTED_CURRENCIES) {
      for (const quote of SUPPORTED_CURRENCIES) {
        if (base === quote) continue;
        try {
          const rate = crossRateFromPivot(fetched.pivotRates, base, quote);
          pairs.push({
            baseCurrency: base,
            quoteCurrency: quote,
            rate: new Prisma.Decimal(rate.toDecimalPlaces(8).toFixed()),
            provider: fetched.provider,
            source: ExchangeRateSource.PROVIDER,
            effectiveAt: fetched.fetchedAt,
            fetchedAt: fetched.fetchedAt,
            createdById: actorId,
          });
        } catch (error) {
          this.logger.warn(
            `Skip pair ${base}/${quote}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    if (pairs.length === 0) {
      throw new ServiceUnavailableException(
        'FX provider returned no usable rates for AFN/EUR/USD',
      );
    }

    await this.prisma.exchangeRate.createMany({ data: pairs });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'EXCHANGE_RATES_REFRESHED',
          entityType: 'ExchangeRate',
          entityId: fetched.provider,
          newValue: {
            provider: fetched.provider,
            pairs: pairs.length,
            fetchedAt: fetched.fetchedAt.toISOString(),
          },
        },
      });
    }

    return this.listLatest();
  }

  async setManualRate(input: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: string;
    reason: string;
    actorId: string;
    effectiveAt?: string;
  }): Promise<ExchangeRateDto> {
    const base = assertSupportedCurrency(input.baseCurrency);
    const quote = assertSupportedCurrency(input.quoteCurrency);
    if (base === quote) {
      throw new BadRequestException(
        'baseCurrency and quoteCurrency must differ',
      );
    }

    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Manual rate reason is required');
    }

    let rateDecimal;
    try {
      rateDecimal = money(input.rate);
    } catch {
      throw new BadRequestException('Invalid rate');
    }
    if (!rateDecimal.isFinite() || rateDecimal.lte(0)) {
      throw new BadRequestException('Rate must be a positive number');
    }

    const effectiveAt = input.effectiveAt
      ? new Date(input.effectiveAt)
      : new Date();
    if (Number.isNaN(effectiveAt.getTime())) {
      throw new BadRequestException('Invalid effectiveAt');
    }

    const fetchedAt = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exchangeRate.create({
        data: {
          baseCurrency: base,
          quoteCurrency: quote,
          rate: new Prisma.Decimal(rateDecimal.toDecimalPlaces(8).toFixed()),
          provider: 'manual',
          source: ExchangeRateSource.MANUAL,
          effectiveAt,
          fetchedAt,
          reason,
          createdById: input.actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'EXCHANGE_RATE_MANUAL_OVERRIDE',
          entityType: 'ExchangeRate',
          entityId: created.id,
          newValue: {
            baseCurrency: base,
            quoteCurrency: quote,
            rate: created.rate.toFixed(),
            reason,
            effectiveAt: effectiveAt.toISOString(),
          },
        },
      });

      return created;
    });

    return this.serialize(row);
  }

  /** Cron-safe refresh with PostgreSQL advisory lock. Keeps old rates on failure. */
  async refreshWithLock(source: string): Promise<void> {
    const lock = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${FX_REFRESH_LOCK_KEY}) AS locked
    `;
    if (!lock[0]?.locked) {
      this.logger.log(`FX refresh skipped (${source}): advisory lock held`);
      return;
    }

    try {
      if (!this.provider.isConfigured()) {
        this.logger.debug(
          `FX refresh skipped (${source}): provider not configured`,
        );
        return;
      }
      await this.refreshFromProvider();
      this.logger.log(
        `FX rates refreshed (${source}) via ${this.provider.name}`,
      );
    } catch (error) {
      this.logger.error(
        `FX refresh failed (${source}): ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(${FX_REFRESH_LOCK_KEY})
      `;
    }
  }
}
