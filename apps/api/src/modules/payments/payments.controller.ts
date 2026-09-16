import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions('payments:read')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.paymentsService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      invoiceId,
      projectId,
    });
  }

  @Get(':id')
  @RequirePermissions('payments:read')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @RequirePermissions('payments:write')
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUserDto) {
    return this.paymentsService.create(dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('payments:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.paymentsService.remove(id, user.id);
  }
}
