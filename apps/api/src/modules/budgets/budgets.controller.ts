import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BudgetsService } from './budgets.service';
import { UpsertBudgetLinesDto } from './dto/upsert-budget-lines.dto';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('projects/:projectId')
  @RequirePermissions('finances:read')
  listForProject(
    @Param('projectId') projectId: string,
    @Query('sync') sync?: string,
  ) {
    const syncFromExpenses = sync === '1' || sync === 'true' || sync === 'yes';
    return this.budgetsService.listForProject(projectId, syncFromExpenses);
  }

  @Put('projects/:projectId')
  @RequirePermissions('finances:write')
  upsertForProject(
    @Param('projectId') projectId: string,
    @Body() dto: UpsertBudgetLinesDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.budgetsService.upsertForProject(projectId, dto, user.id);
  }
}
