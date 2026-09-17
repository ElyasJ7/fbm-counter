import { Global, Module } from '@nestjs/common';
import { NumberingService } from './numbering.service';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  providers: [NumberingService, MetricsService],
  exports: [NumberingService, MetricsService],
})
export class CommonModule {}
