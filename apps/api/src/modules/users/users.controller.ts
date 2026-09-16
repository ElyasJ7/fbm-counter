import { Controller, Get } from '@nestjs/common';
import { ROLE_PERMISSIONS } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
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
}
