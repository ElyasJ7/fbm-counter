import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AppModule } from '../../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ExpensesService } from './expenses.service';
import type { AuthUserDto } from '@fbm/shared';

describe('ExpensesService payment policy', () => {
  let expenses: ExpensesService;
  let prisma: PrismaService;
  let admin: AuthUserDto;
  let accounting: AuthUserDto;
  let expenseId: string | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expenses = moduleRef.get(ExpensesService);
    prisma = moduleRef.get(PrismaService);

    const adminRow = await prisma.user.findFirst({
      where: { role: Role.ADMIN, deletedAt: null },
    });
    const accountingRow = await prisma.user.findFirst({
      where: { role: Role.ACCOUNTING, deletedAt: null },
    });
    if (!adminRow) {
      throw new Error('Seed ADMIN user required for expenses.payment.spec');
    }
    admin = {
      id: adminRow.id,
      email: adminRow.email,
      firstName: adminRow.firstName,
      lastName: adminRow.lastName,
      role: adminRow.role,
      preferredDisplayCurrency: adminRow.preferredDisplayCurrency,
    };
    accounting = accountingRow
      ? {
          id: accountingRow.id,
          email: accountingRow.email,
          firstName: accountingRow.firstName,
          lastName: accountingRow.lastName,
          role: accountingRow.role,
          preferredDisplayCurrency: accountingRow.preferredDisplayCurrency,
        }
      : {
          ...admin,
          id: 'accounting-actor',
          role: Role.ACCOUNTING,
        };
  });

  afterEach(async () => {
    if (expenseId) {
      await prisma.expense.deleteMany({ where: { id: expenseId } });
      expenseId = undefined;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates expenses as fully paid', async () => {
    const result = await expenses.create(
      {
        description: 'Fully paid expense',
        netAmount: '100',
        taxRate: '0',
        currency: 'AFN',
        category: 'Materials custom',
      },
      admin,
    );
    expenseId = result.id;
    expect(result.status).toBe('PAID');
    expect(Number(result.paidAmount)).toBe(Number(result.grossAmount));
    expect(result.category).toBe('Materials custom');
  });

  it('blocks accounting over the 5000 AFN gross limit', async () => {
    await expect(
      expenses.create(
        {
          description: 'Too large for accounting',
          netAmount: '5001',
          taxRate: '0',
          currency: 'AFN',
        },
        accounting,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows accounting at or under 5000 AFN gross', async () => {
    const result = await expenses.create(
      {
        description: 'Within accounting limit',
        netAmount: '5000',
        taxRate: '0',
        currency: 'AFN',
      },
      accounting,
    );
    expenseId = result.id;
    expect(result.status).toBe('PAID');
    expect(Number(result.grossAmount)).toBe(5000);
  });

  it('blocks non-admin delete', async () => {
    const created = await expenses.create(
      {
        description: 'Delete guard',
        netAmount: '10',
        taxRate: '0',
        currency: 'AFN',
      },
      admin,
    );
    expenseId = created.id;
    await expect(expenses.remove(created.id, accounting)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
