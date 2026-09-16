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
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUserDto } from '@fbm/shared';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('projects:read')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
    });
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @RequirePermissions('projects:write')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUserDto) {
    return this.customersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('projects:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.customersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.customersService.remove(id, user.id);
  }
}
