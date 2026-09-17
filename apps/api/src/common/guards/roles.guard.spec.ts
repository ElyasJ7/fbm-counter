import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../decorators/auth.decorators';

function makeContext(user?: { role: string }, method = 'GET') {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user, method }),
    }),
  } as never;
}

describe('RolesGuard', () => {
  it('allows public routes without user', () => {
    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      },
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext(undefined, 'POST'))).toBe(true);
  });

  it('allows GET when no roles/permissions required (JWT-only reads)', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('denies POST when no roles/permissions metadata (fail closed)', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() =>
      guard.canActivate(makeContext({ role: 'ADMIN' }, 'POST')),
    ).toThrow(ForbiddenException);
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
    expect(guard.canActivate(makeContext({ role: 'ACCOUNTING' }, 'POST'))).toBe(
      true,
    );
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
