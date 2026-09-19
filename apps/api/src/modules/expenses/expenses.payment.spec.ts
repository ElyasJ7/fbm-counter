import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExpenseStatus } from '@prisma/client';
import type { AuthUserDto } from '@fbm/shared';
import { ProjectAccessService } from '../authz/project-access.service';
import { BudgetsService } from '../budgets/budgets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

describe('ExpensesService payment integrity (H4)', () => {
  let expenses: ExpensesService;
  let prisma: PrismaService;
  let expenseId: string;
  let actor: AuthUserDto;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://fbm:fbm_dev_password@localhost:5432/fbm_counter?schema=public';

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpensesService,
        PrismaService,
        ProjectAccessService,
        {
          provide: BudgetsService,
          useValue: {
            syncAndNotifyOverruns: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createForRoles: jest.fn().mockResolvedValue({ created: 0 }),
            notifyProjectManager: jest.fn().mockResolvedValue({ created: 0 }),
          },
        },
      ],
    }).compile();

    expenses = moduleRef.get(ExpensesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', deletedAt: null },
    });
    actor = {
      id: admin!.id,
      email: admin!.email,
      firstName: admin!.firstName,
      lastName: admin!.lastName,
      role: 'ADMIN',
    };

    const row = await prisma.expense.create({
      data: {
        expenseNumber: `EXP-PAY-${Date.now()}`,
        description: 'payment integrity',
        netAmount: '100',
        taxRate: '19',
        taxAmount: '19',
        grossAmount: '119',
        paidAmount: '0',
        status: ExpenseStatus.APPROVED,
      },
    });
    expenseId = row.id;
  });

  afterAll(async () => {
    if (expenseId) {
      await prisma.expense.deleteMany({ where: { id: expenseId } });
    }
    await prisma.$disconnect();
  });

  it('rejects negative payment amounts', async () => {
    await expect(
      expenses.recordPayment(expenseId, { amount: '-10' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects payment that would exceed gross', async () => {
    await expect(
      expenses.recordPayment(expenseId, { amount: '200' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a normal payment and updates paidAmount', async () => {
    const result = await expenses.recordPayment(
      expenseId,
      { amount: '50' },
      actor,
    );
    expect(Number(result.paidAmount)).toBe(50);
    expect(result.status).toBe(ExpenseStatus.PARTIALLY_PAID);
  });

  it('ignores paidAmount on unrestricted update', async () => {
    const updated = await expenses.update(
      expenseId,
      {
        description: 'still payment integrity',
        // @ts-expect-error — client must not be able to set paidAmount
        paidAmount: '999',
      } as never,
      actor,
    );
    expect(Number(updated.paidAmount)).toBe(50);
  });
});
