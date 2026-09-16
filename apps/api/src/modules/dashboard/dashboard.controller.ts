import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequirePermissions('reports:read')
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
