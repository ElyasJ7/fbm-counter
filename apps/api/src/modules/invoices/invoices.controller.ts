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
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('invoices:read')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('type') type?: InvoiceType,
    @Query('projectId') projectId?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.invoicesService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      type,
      projectId,
      status,
    });
  }

  @Get(':id')
  @RequirePermissions('invoices:read')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @RequirePermissions('invoices:write')
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUserDto) {
    return this.invoicesService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('invoices:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.invoicesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('invoices:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.invoicesService.remove(id, user.id);
  }
}
