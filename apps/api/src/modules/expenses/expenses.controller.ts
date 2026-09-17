import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ExpenseStatus } from '@prisma/client';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { RecordExpensePaymentDto } from './dto/record-expense-payment.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequirePermissions('expenses:read')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: ExpenseStatus,
  ) {
    return this.expensesService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      projectId,
      status,
    });
  }

  @Get(':id')
  @RequirePermissions('expenses:read')
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  @RequirePermissions('expenses:write')
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthUserDto) {
    return this.expensesService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('expenses:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.expensesService.update(id, dto, user.id);
  }

  @Post(':id/payments')
  @RequirePermissions('finances:write')
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordExpensePaymentDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.expensesService.recordPayment(id, dto, user.id);
  }

  /** Approval is a distinct financial control — not covered by expenses:write. */
  @Patch(':id/approve')
  @RequirePermissions('finances:approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.expensesService.approve(id, user.id);
  }

  @Delete(':id')
  @RequirePermissions('expenses:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.expensesService.remove(id, user.id);
  }
}
