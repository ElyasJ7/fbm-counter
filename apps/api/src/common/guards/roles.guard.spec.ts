import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators/auth.decorators';

function makeContext(user?: { role: string }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows when no roles/permissions required', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('forbids VIEWER from invoices:write', () => {
    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === PERMISSIONS_KEY) return ['invoices:write'];
        if (key === ROLES_KEY) return undefined;
        return undefined;
      },
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: 'VIEWER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows ACCOUNTING for invoices:write', () => {
    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === PERMISSIONS_KEY) return ['invoices:write'];
        return undefined;
      },
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: 'ACCOUNTING' }))).toBe(true);
  });

  it('forbids missing user when permissions required', () => {
    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === PERMISSIONS_KEY) return ['projects:read'];
        return undefined;
      },
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext())).toThrow(ForbiddenException);
  });
});
