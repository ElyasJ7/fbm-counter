import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { BUDGET_CATEGORY_LABELS } from '@fbm/shared';
import type { AuthUserDto } from '@fbm/shared';
import { aggregateCosts, computeBudgetLine, money } from '@fbm/financial-core';
import { ProjectAccessService } from '../authz/project-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertBudgetLinesDto } from './dto/upsert-budget-lines.dto';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private serializeLine(line: {
    id: string;
    projectId: string;
    category: string;
    plannedAmount: Prisma.Decimal;
    committedAmount: Prisma.Decimal;
    actualAmount: Prisma.Decimal;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const computed = computeBudgetLine({
      plannedAmount: line.plannedAmount.toString(),
      committedAmount: line.committedAmount.toString(),
      actualAmount: line.actualAmount.toString(),
    });
    return {
      id: line.id,
      projectId: line.projectId,
      category: line.category,
      notes: line.notes,
      createdAt: line.createdAt.toISOString(),
      updatedAt: line.updatedAt.toISOString(),
      ...computed,
    };
  }

  /**
   * Roll actual/committed from canonical cost policy (supplier invoices +
   * non-duplicate expenses). Supplier invoice amounts land in OTHER.
   */
  private async syncAmountsFromCosts(projectId: string) {
    const [expenses, supplierInvoices, lines] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          projectId,
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: {
          category: true,
          status: true,
          grossAmount: true,
          paidAmount: true,
          invoiceNumber: true,
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          projectId,
          deletedAt: null,
          type: 'SUPPLIER',
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        select: {
          status: true,
          grossAmount: true,
          paidAmount: true,
          invoiceNumber: true,
        },
      }),
      this.prisma.budgetLine.findMany({
        where: { projectId },
        select: { id: true, category: true },
      }),
    ]);

    const costs = aggregateCosts({
      expenses: expenses.map((row) => ({
        status: row.status,
        grossAmount: row.grossAmount.toString(),
        paidAmount: row.paidAmount.toString(),
        invoiceNumber: row.invoiceNumber,
        category: row.category,
      })),
      supplierInvoices: supplierInvoices.map((row) => ({
        status: row.status,
        grossAmount: row.grossAmount.toString(),
        paidAmount: row.paidAmount.toString(),
        invoiceNumber: row.invoiceNumber,
      })),
    });

    for (const line of lines) {
      const amounts = costs.byCategory[line.category] ?? {
        actual: '0.0000',
        committed: '0.0000',
      };
      await this.prisma.budgetLine.update({
        where: { id: line.id },
        data: {
          actualAmount: amounts.actual,
          committedAmount: amounts.committed,
        },
      });
    }
  }

  /** Sync cost totals into budget lines and notify on newly detected overruns. */
  async syncAndNotifyOverruns(projectId: string, actorId?: string) {
    await this.assertProject(projectId);
    await this.syncAmountsFromCosts(projectId);

    const [project, lines] = await Promise.all([
      this.prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: {
          id: true,
          projectNumber: true,
          name: true,
          projectManagerId: true,
        },
      }),
      this.prisma.budgetLine.findMany({ where: { projectId } }),
    ]);
    if (!project) return;

    for (const line of lines) {
      const computed = computeBudgetLine({
        plannedAmount: line.plannedAmount.toString(),
        committedAmount: line.committedAmount.toString(),
        actualAmount: line.actualAmount.toString(),
      });
      const remaining = money(computed.remainingAmount);
      if (!remaining.lessThan(0)) continue;

      const link = `/projects/${projectId}?tab=budget`;
      const type = 'budget.overrun';
      const categoryLabel =
        BUDGET_CATEGORY_LABELS[line.category] ?? line.category;

      const recipients = new Set<string>();
      if (project.projectManagerId && project.projectManagerId !== actorId) {
        recipients.add(project.projectManagerId);
      }

      const managers = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          role: { in: [Role.MANAGEMENT, Role.ACCOUNTING] },
          ...(actorId ? { id: { not: actorId } } : {}),
        },
        select: { id: true },
      });
      for (const user of managers) recipients.add(user.id);

      for (const userId of recipients) {
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId,
            type,
            link,
            readAt: null,
            message: { contains: categoryLabel },
          },
        });
        if (existing) continue;

        await this.notifications.createForUsers([userId], {
          title: 'Budget exceeded',
          message: `${project.projectNumber}: Category ${categoryLabel} is over budget (remaining ${computed.remainingAmount}).`,
          type,
          link,
        });
      }
    }
  }

  async listForProject(
    projectId: string,
    syncFromExpenses = false,
    user: AuthUserDto,
  ) {
    await this.projectAccess.assertCanAccessProject(user, projectId);
    await this.assertProject(projectId);

    if (syncFromExpenses) {
      await this.syncAmountsFromCosts(projectId);
    }

    const lines = await this.prisma.budgetLine.findMany({
      where: { projectId },
      orderBy: { category: 'asc' },
    });

    return {
      data: lines.map((line) => this.serializeLine(line)),
    };
  }

  async upsertForProject(
    projectId: string,
    dto: UpsertBudgetLinesDto,
    user: AuthUserDto,
  ) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessProject(user, projectId);
    await this.assertProject(projectId);

    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const line of dto.lines) {
        const upserted = await tx.budgetLine.upsert({
          where: {
            projectId_category: {
              projectId,
              category: line.category,
            },
          },
          create: {
            projectId,
            category: line.category,
            plannedAmount: line.plannedAmount,
            committedAmount: line.committedAmount ?? '0',
            actualAmount: line.actualAmount ?? '0',
            notes: line.notes,
          },
          update: {
            plannedAmount: line.plannedAmount,
            ...(line.committedAmount !== undefined
              ? { committedAmount: line.committedAmount }
              : {}),
            ...(line.actualAmount !== undefined
              ? { actualAmount: line.actualAmount }
              : {}),
            ...(line.notes !== undefined ? { notes: line.notes } : {}),
          },
        });
        results.push(upserted);
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BUDGET_LINES_UPSERTED',
          entityType: 'BudgetLine',
          entityId: projectId,
          newValue: {
            projectId,
            categories: dto.lines.map((l) => l.category),
          },
        },
      });

      return {
        data: results.map((line) => this.serializeLine(line)),
      };
    });
  }
}
