import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions('reports:read')
  getDashboard(
    @CurrentUser() user: AuthUserDto,
    @Query('currency') currency?: string,
  ) {
    return this.dashboardService.getDashboard(user, currency);
  }
}
