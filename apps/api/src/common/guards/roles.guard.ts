import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  roleHasPermission,
  type AuthUserDto,
  type Permission,
  type Role,
} from '@fbm/shared';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators/auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUserDto }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    if (requiredPermissions?.length) {
      const missing = requiredPermissions.some(
        (permission) => !roleHasPermission(user.role, permission),
      );
      if (missing) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
