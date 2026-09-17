import { ForbiddenException } from '@nestjs/common';
import { assertCanApproveExpense } from './expense-approve.guard';

describe('expense approve permission', () => {
  it('allows ADMIN', () => {
    expect(() => assertCanApproveExpense('ADMIN')).not.toThrow();
  });

  it('allows MANAGEMENT with finances:approve', () => {
    expect(() => assertCanApproveExpense('MANAGEMENT')).not.toThrow();
  });

  it('allows ACCOUNTING with finances:approve', () => {
    expect(() => assertCanApproveExpense('ACCOUNTING')).not.toThrow();
  });

  it('rejects PROJECT_MANAGER with expenses:write only', () => {
    expect(() => assertCanApproveExpense('PROJECT_MANAGER')).toThrow(
      ForbiddenException,
    );
  });

  it('rejects VIEWER', () => {
    expect(() => assertCanApproveExpense('VIEWER')).toThrow(ForbiddenException);
  });
});
