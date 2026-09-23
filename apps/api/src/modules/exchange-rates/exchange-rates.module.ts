import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CurrencyConversionService } from './currency-conversion.service';
import { DisplayFxService } from './display-fx.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { EXCHANGE_RATE_PROVIDER } from './providers/exchange-rate.provider';
import { ExchangeRateApiProvider } from './providers/exchange-rate-api.provider';
import { NoopExchangeRateProvider } from './providers/noop.provider';
import { OpenExchangeRatesProvider } from './providers/open-exchange-rates.provider';

@Module({
  imports: [PrismaModule],
  controllers: [ExchangeRatesController],
  providers: [
    {
      provide: EXCHANGE_RATE_PROVIDER,
      useFactory: (config: ConfigService) => {
        const raw = (config.get<string>('FX_PROVIDER') ?? 'none')
          .trim()
          .toLowerCase();
        const apiKey = config.get<string>('FX_API_KEY') ?? undefined;

        if (raw === 'openexchangerates' || raw === 'open-exchange-rates') {
          return new OpenExchangeRatesProvider(apiKey);
        }
        if (
          raw === 'exchangerate-api' ||
          raw === 'exchangerateapi' ||
          raw === 'exchange-rate-api'
        ) {
          return new ExchangeRateApiProvider(apiKey);
        }
        return new NoopExchangeRateProvider();
      },
      inject: [ConfigService],
    },
    ExchangeRatesService,
    CurrencyConversionService,
    DisplayFxService,
  ],
  exports: [ExchangeRatesService, CurrencyConversionService, DisplayFxService],
})
export class ExchangeRatesModule {}
