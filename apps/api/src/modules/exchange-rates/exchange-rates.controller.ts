import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { AuthUserDto } from '@fbm/shared';
import {
  RequirePermissions,
  Roles,
} from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConvertMoneyDto } from './dto/convert-money.dto';
import { ManualExchangeRateDto } from './dto/manual-exchange-rate.dto';
import { CurrencyConversionService } from './currency-conversion.service';
import { ExchangeRatesService } from './exchange-rates.service';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(
    private readonly exchangeRates: ExchangeRatesService,
    private readonly conversion: CurrencyConversionService,
  ) {}

  @Get()
  @RequirePermissions('finances:read')
  list() {
    return this.exchangeRates.listLatest();
  }

  @Get('latest')
  @RequirePermissions('finances:read')
  latest() {
    return this.exchangeRates.listLatest();
  }

  /** Preview a conversion using cached rates (display or as-of). */
  @Get('convert')
  @RequirePermissions('finances:read')
  convertGet(
    @Query('amount') amount: string,
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.conversion.convert({
      amount,
      fromCurrency,
      toCurrency,
      asOf: asOf || undefined,
      forDisplay: !asOf,
    });
  }

  @Post('convert')
  @RequirePermissions('finances:read')
  convertPost(@Body() dto: ConvertMoneyDto) {
    return this.conversion.convert({
      amount: dto.amount,
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      asOf: dto.asOf,
      forDisplay: !dto.asOf,
    });
  }

  @Post('refresh')
  @Roles('ADMIN', 'MANAGEMENT')
  refresh(@CurrentUser() user: AuthUserDto) {
    return this.exchangeRates.refreshFromProvider(user.id);
  }

  @Post('manual')
  @Roles('ADMIN', 'MANAGEMENT')
  manual(@Body() dto: ManualExchangeRateDto, @CurrentUser() user: AuthUserDto) {
    return this.exchangeRates.setManualRate({
      baseCurrency: dto.baseCurrency,
      quoteCurrency: dto.quoteCurrency,
      rate: dto.rate,
      reason: dto.reason,
      effectiveAt: dto.effectiveAt,
      actorId: user.id,
    });
  }
}
