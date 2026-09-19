import { Global, Module } from '@nestjs/common';
import { ProjectAccessService } from '../authz/project-access.service';
import { NumberingService } from './numbering.service';
import { MetricsService } from './metrics.service';
import { ProductionConfigValidator } from './production-config.validator';

@Global()
@Module({
  providers: [
    NumberingService,
    MetricsService,
    ProjectAccessService,
    ProductionConfigValidator,
  ],
  exports: [NumberingService, MetricsService, ProjectAccessService],
})
export class CommonModule {}
