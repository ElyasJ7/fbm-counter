import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

@Injectable()
export class ExchangeRatesRefreshJob {
  private readonly logger = new Logger(ExchangeRatesRefreshJob.name);

  constructor(private readonly exchangeRates: ExchangeRatesService) {}

  /** Refresh cached FX rates about every 4 hours. */
  @Cron(CronExpression.EVERY_4_HOURS)
  async handleCron() {
    try {
      await this.exchangeRates.refreshWithLock('cron');
    } catch (error) {
      this.logger.error(
        `Scheduled FX refresh error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
