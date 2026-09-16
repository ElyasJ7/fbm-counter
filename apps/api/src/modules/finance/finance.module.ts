import { Module } from '@nestjs/common';
import { ProjectFinanceService } from './project-finance.service';

@Module({
  providers: [ProjectFinanceService],
  exports: [ProjectFinanceService],
})
export class FinanceModule {}
