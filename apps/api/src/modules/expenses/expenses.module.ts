import { Module } from '@nestjs/common';
import { BudgetsModule } from '../budgets/budgets.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [NotificationsModule, BudgetsModule, ExchangeRatesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
