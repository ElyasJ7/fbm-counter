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
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../decorators/auth.decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<{
      user?: AuthUserDto;
      method?: string;
    }>();
    const method = (request.method ?? 'GET').toUpperCase();

    // Fail closed for mutating business routes without explicit authz metadata.
    if (!requiredRoles?.length && !requiredPermissions?.length) {
      if (SAFE_METHODS.has(method)) {
        return true;
      }
      throw new ForbiddenException(
        'Missing authorization metadata for mutating route',
      );
    }

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
