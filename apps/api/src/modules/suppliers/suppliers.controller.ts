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
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers:read')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.suppliersService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
    });
  }

  @Get(':id')
  @RequirePermissions('suppliers:read')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @RequirePermissions('suppliers:write')
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthUserDto) {
    return this.suppliersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('suppliers:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.suppliersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('suppliers:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.suppliersService.remove(id, user.id);
  }
}
