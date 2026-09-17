import { Module } from '@nestjs/common';
import { FinanceQueryService } from './finance-query.service';
import { ProjectFinanceService } from './project-finance.service';

@Module({
  providers: [ProjectFinanceService, FinanceQueryService],
  exports: [ProjectFinanceService, FinanceQueryService],
})
export class FinanceModule {}
