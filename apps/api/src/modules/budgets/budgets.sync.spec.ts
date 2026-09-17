import { Test } from '@nestjs/testing';
import {
  BudgetCategory,
  ExpenseStatus,
  InvoiceStatus,
  InvoiceType,
  ProjectStatus,
} from '@prisma/client';
import { aggregateCosts } from '@fbm/financial-core';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceQueryService } from '../finance/finance-query.service';
import { ProjectFinanceService } from '../finance/project-finance.service';
import { BudgetsService } from './budgets.service';

describe('Budget sync vs project overview actuals', () => {
  let prisma: PrismaService;
  let budgets: BudgetsService;
  let finance: ProjectFinanceService;
  let projectId: string;
  let customerId: string;
  let actorId: string;
  let expenseId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://fbm:fbm_dev_password@localhost:5432/fbm_counter?schema=public';

    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetsService,
        ProjectFinanceService,
        FinanceQueryService,
        PrismaService,
        {
          provide: NotificationsService,
          useValue: {
            createForUsers: jest.fn().mockResolvedValue(undefined),
            notifyProjectManager: jest.fn().mockResolvedValue(undefined),
            createForRoles: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    budgets = moduleRef.get(BudgetsService);
    finance = moduleRef.get(ProjectFinanceService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const stamp = Date.now();
    const actor = await prisma.user.create({
      data: {
        email: `budget-actor-${stamp}@example.com`,
        passwordHash: 'test-hash',
        firstName: 'Budget',
        lastName: 'Actor',
        role: 'ACCOUNTING',
      },
    });
    actorId = actor.id;

    const customer = await prisma.customer.create({
      data: { companyName: `Budget Sync Co ${stamp}` },
    });
    customerId = customer.id;

    const project = await prisma.project.create({
      data: {
        projectNumber: `P-BUD-${stamp}`,
        name: 'Budget sync project',
        customerId,
        status: ProjectStatus.ACTIVE,
        contractValue: '10000',
        initialBudget: '5000',
        currentBudget: '5000',
        currency: 'EUR',
      },
    });
    projectId = project.id;

    await prisma.budgetLine.create({
      data: {
        projectId,
        category: BudgetCategory.OTHER,
        plannedAmount: '5000',
        actualAmount: '0',
        committedAmount: '0',
      },
    });
  });

  afterAll(async () => {
    if (expenseId) {
      await prisma.expense.deleteMany({ where: { id: expenseId } });
    }
    if (projectId) {
      await prisma.budgetLine.deleteMany({ where: { projectId } });
      await prisma.invoice.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    if (customerId) {
      await prisma.customer.deleteMany({ where: { id: customerId } });
    }
    if (actorId) {
      await prisma.auditLog.deleteMany({ where: { actorId } });
      await prisma.notification.deleteMany({ where: { userId: actorId } });
      await prisma.user.deleteMany({ where: { id: actorId } });
    }
    await prisma.$disconnect();
  });

  it('keeps budget OTHER actual equal to project overview after cost mutations', async () => {
    const expense = await prisma.expense.create({
      data: {
        expenseNumber: `EX-BUD-${Date.now()}`,
        projectId,
        category: BudgetCategory.OTHER,
        description: 'Sync test expense',
        netAmount: '100',
        taxRate: '19',
        taxAmount: '19',
        grossAmount: '119',
        paidAmount: '119',
        status: ExpenseStatus.PAID,
      },
    });
    expenseId = expense.id;

    await budgets.syncAndNotifyOverruns(projectId, actorId);

    let lines = await budgets.listForProject(projectId, false);
    let other = lines.data.find((l) => l.category === 'OTHER');
    let overview = await finance.getOverview(projectId);

    expect(other?.actualAmount).toBe('119.0000');
    expect(overview?.actualCosts).toBe('119.0000');

    await prisma.expense.update({
      where: { id: expenseId },
      data: { paidAmount: '50', status: ExpenseStatus.PARTIALLY_PAID },
    });
    await budgets.syncAndNotifyOverruns(projectId, actorId);

    lines = await budgets.listForProject(projectId, false);
    other = lines.data.find((l) => l.category === 'OTHER');
    overview = await finance.getOverview(projectId);
    expect(other?.actualAmount).toBe('50.0000');
    expect(overview?.actualCosts).toBe('50.0000');

    await prisma.invoice.create({
      data: {
        invoiceNumber: `ER-BUD-${Date.now()}`,
        type: InvoiceType.SUPPLIER,
        projectId,
        issueDate: new Date(),
        dueDate: new Date(),
        netAmount: '200',
        taxRate: '19',
        taxAmount: '38',
        grossAmount: '238',
        paidAmount: '238',
        status: InvoiceStatus.PAID,
      },
    });
    await budgets.syncAndNotifyOverruns(projectId, actorId);

    lines = await budgets.listForProject(projectId, false);
    other = lines.data.find((l) => l.category === 'OTHER');
    overview = await finance.getOverview(projectId);

    const costs = aggregateCosts({
      expenses: [
        {
          status: 'PARTIALLY_PAID',
          grossAmount: '119',
          paidAmount: '50',
          category: 'OTHER',
        },
      ],
      supplierInvoices: [
        {
          status: 'PAID',
          grossAmount: '238',
          paidAmount: '238',
          invoiceNumber: 'x',
        },
      ],
    });

    expect(other?.actualAmount).toBe(costs.actualCosts);
    expect(overview?.actualCosts).toBe(costs.actualCosts);

    await prisma.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date() },
    });
    await budgets.syncAndNotifyOverruns(projectId, actorId);

    lines = await budgets.listForProject(projectId, false);
    other = lines.data.find((l) => l.category === 'OTHER');
    overview = await finance.getOverview(projectId);
    expect(other?.actualAmount).toBe('238.0000');
    expect(overview?.actualCosts).toBe('238.0000');
  });
});
