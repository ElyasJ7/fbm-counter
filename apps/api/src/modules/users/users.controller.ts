import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ROLE_PERMISSIONS, type AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  findAll() {
    return this.usersService.findAll();
  }

  @Get('managers')
  @RequirePermissions('projects:read')
  findManagers() {
    return this.usersService.findProjectManagers();
  }

  @Get('roles')
  @RequirePermissions('users:read')
  roles() {
    return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      permissions,
    }));
  }

  @Post()
  @RequirePermissions('users:write')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUserDto) {
    return this.usersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('users:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @Post(':id/deactivate')
  @RequirePermissions('users:write')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.usersService.deactivate(id, user.id);
  }
}
