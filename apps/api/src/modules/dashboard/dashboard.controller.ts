import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('reports:read')
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
