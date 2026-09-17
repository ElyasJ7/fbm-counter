import { ForbiddenException } from '@nestjs/common';
import { roleHasPermission, type Role } from '@fbm/shared';

/**
 * Pure guard helper for expense approval — mirrors @RequirePermissions('finances:approve').
 * Kept testable without Nest DI.
 */
export function assertCanApproveExpense(role: Role): void {
  if (!roleHasPermission(role, 'finances:approve')) {
    throw new ForbiddenException('Insufficient permissions');
  }
}
