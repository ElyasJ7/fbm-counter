import {
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';

/**
 * Payments UI and ledger recording are retired. Invoices/expenses are
 * recorded as fully paid; this controller stays only to return 410 Gone.
 */
@Controller('payments')
export class PaymentsController {
  private gone(): never {
    throw new GoneException(
      'Payments recording was removed. Record invoices and expenses as fully paid amounts.',
    );
  }

  @Get()
  @RequirePermissions('payments:read')
  findAll(
    @CurrentUser() _user: AuthUserDto,
    @Query('page') _page?: string,
    @Query('pageSize') _pageSize?: string,
    @Query('invoiceId') _invoiceId?: string,
    @Query('projectId') _projectId?: string,
  ) {
    return this.gone();
  }

  @Get(':id')
  @RequirePermissions('payments:read')
  findOne(@Param('id') _id: string, @CurrentUser() _user: AuthUserDto) {
    return this.gone();
  }

  @Post()
  @RequirePermissions('payments:write')
  create(
    @Body() _dto: CreatePaymentDto,
    @CurrentUser() _user: AuthUserDto,
  ) {
    return this.gone();
  }

  @Delete(':id')
  @RequirePermissions('payments:write')
  remove(@Param('id') _id: string, @CurrentUser() _user: AuthUserDto) {
    return this.gone();
  }
}
