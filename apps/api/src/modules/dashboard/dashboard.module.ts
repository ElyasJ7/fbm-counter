import { Module } from '@nestjs/common';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { FinanceModule } from '../finance/finance.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [FinanceModule, ExchangeRatesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
