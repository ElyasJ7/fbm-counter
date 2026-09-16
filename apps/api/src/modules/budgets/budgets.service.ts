import { Injectable, NotFoundException } from '@nestjs/common';
import { BudgetCategory, Prisma } from '@prisma/client';
import { computeBudgetLine, money } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertBudgetLinesDto } from './dto/upsert-budget-lines.dto';

const OPEN_EXPENSE_STATUSES = [
  'PENDING',
  'APPROVED',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private serializeLine(
    line: {
      id: string;
      projectId: string;
      category: string;
      plannedAmount: Prisma.Decimal;
      committedAmount: Prisma.Decimal;
      actualAmount: Prisma.Decimal;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
  ) {
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

  /** Optionally roll actual/committed from project expenses by category. */
  private async syncAmountsFromExpenses(projectId: string) {
    const expenses = await this.prisma.expense.findMany({
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
      },
    });

    const byCategory = new Map<
      string,
      { actual: ReturnType<typeof money>; committed: ReturnType<typeof money> }
    >();

    for (const expense of expenses) {
      const entry = byCategory.get(expense.category) ?? {
        actual: money(0),
        committed: money(0),
      };
      entry.actual = entry.actual.plus(expense.paidAmount);
      if (
        OPEN_EXPENSE_STATUSES.includes(
          expense.status as (typeof OPEN_EXPENSE_STATUSES)[number],
        )
      ) {
        entry.committed = entry.committed.plus(
          money(expense.grossAmount).minus(expense.paidAmount),
        );
      }
      byCategory.set(expense.category, entry);
    }

    for (const [category, amounts] of byCategory) {
      await this.prisma.budgetLine.updateMany({
        where: {
          projectId,
          category: category as BudgetCategory,
        },
        data: {
          actualAmount: amounts.actual.toFixed(4),
          committedAmount: amounts.committed.toFixed(4),
        },
      });
    }
  }

  async listForProject(projectId: string, syncFromExpenses = false) {
    await this.assertProject(projectId);

    if (syncFromExpenses) {
      await this.syncAmountsFromExpenses(projectId);
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
    actorId: string,
  ) {
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
