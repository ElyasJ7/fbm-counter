import { AuditService } from './audit.service';

describe('AuditService date parsing', () => {
  const service = new AuditService({} as never);

  it('accepts YYYY-MM-DD boundaries via findAll filters without throwing', async () => {
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([0, []]),
      auditLog: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const scoped = new AuditService(prisma as never);
    await expect(
      scoped.findAll({ from: '2026-01-01', to: '2026-01-31' }),
    ).resolves.toMatchObject({
      data: [],
      meta: { page: 1, total: 0 },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // Keep reference so unused-local lint does not fire if tree-shaken oddly
  void service;
});
