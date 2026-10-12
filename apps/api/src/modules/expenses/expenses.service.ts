import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExpenseStatus, Prisma, Role } from '@prisma/client';
import {
  calculateGrossAmount,
  calculateTaxAmount,
  money,
  resolveExpenseStatus,
} from '@fbm/financial-core';
import {
  ACCOUNTING_EXPENSE_GROSS_LIMIT_AFN,
  type AuthUserDto,
} from '@fbm/shared';
import { ProjectAccessService } from '../authz/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveTransactionCurrency } from '../common/transaction-currency';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';

const expenseInclude = {
  project: { select: { id: true, projectNumber: true, name: true } },
  supplier: { select: { id: true, companyName: true } },
} satisfies Prisma.ExpenseInclude;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly budgets: BudgetsService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private decimalToString(value: Prisma.Decimal | string | number): string {
    return value.toString();
  }

  private async nextExpenseNumber(tx: Prisma.TransactionClient = this.prisma) {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    const latest = await tx.expense.findFirst({
      where: { expenseNumber: { startsWith: prefix } },
      orderBy: { expenseNumber: 'desc' },
      select: { expenseNumber: true },
    });
    let seq = 1;
    if (latest) {
      const part = latest.expenseNumber.split('-').pop();
      seq = (Number(part) || 0) + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private computeTax(netAmount: string, taxRate: string) {
    return {
      taxAmount: calculateTaxAmount(netAmount, taxRate).toFixed(4),
      grossAmount: calculateGrossAmount(netAmount, taxRate).toFixed(4),
    };
  }

  private serialize(
    expense: Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>,
  ) {
    const status = resolveExpenseStatus({
      currentStatus: expense.status,
      grossAmount: expense.grossAmount.toString(),
      paidAmount: expense.paidAmount.toString(),
      dueDate: expense.dueDate,
    });

    return {
      id: expense.id,
      expenseNumber: expense.expenseNumber,
      projectId: expense.projectId,
      category: expense.category,
      supplierId: expense.supplierId,
      description: expense.description,
      invoiceNumber: expense.invoiceNumber,
      invoiceDate: expense.invoiceDate?.toISOString() ?? null,
      dueDate: expense.dueDate?.toISOString() ?? null,
      netAmount: this.decimalToString(expense.netAmount),
      taxRate: this.decimalToString(expense.taxRate),
      taxAmount: this.decimalToString(expense.taxAmount),
      grossAmount: this.decimalToString(expense.grossAmount),
      paidAmount: this.decimalToString(expense.paidAmount),
      currency: expense.currency,
      status,
      paymentDate: expense.paymentDate?.toISOString() ?? null,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
      project: expense.project,
      supplier: expense.supplier,
    };
  }

  private async assertProject(projectId?: string | null) {
    if (!projectId) return;
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      throw new BadRequestException('Project not found');
    }
  }

  private async assertSupplier(supplierId?: string | null) {
    if (!supplierId) return;
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
    });
    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }
  }

  private normalizeCategory(category?: string | null): string {
    const trimmed = category?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : 'OTHER';
  }

  /**
   * ADMIN / PROJECT_MANAGER: full write.
   * ACCOUNTING: create/edit only when gross ≤ 5,000 AFN (AFN currency required).
   */
  private assertCanWriteExpenseAmount(
    user: AuthUserDto,
    grossAmount: string,
    currency: string,
  ) {
    if (user.role === Role.ADMIN || user.role === Role.PROJECT_MANAGER) {
      return;
    }
    if (user.role !== Role.ACCOUNTING) {
      throw new ForbiddenException(
        'Only Admin, Project Manager, or Accounting can edit expenses',
      );
    }
    if (currency.trim().toUpperCase() !== 'AFN') {
      throw new ForbiddenException(
        `Accounting may only record expenses in AFN (limit ${ACCOUNTING_EXPENSE_GROSS_LIMIT_AFN} AFN)`,
      );
    }
    if (money(grossAmount).greaterThan(ACCOUNTING_EXPENSE_GROSS_LIMIT_AFN)) {
      throw new ForbiddenException(
        `Accounting expense limit is ${ACCOUNTING_EXPENSE_GROSS_LIMIT_AFN} AFN gross`,
      );
    }
  }

  async findAll(
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      projectId?: string;
      status?: ExpenseStatus;
    },
    user: AuthUserDto,
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      AND: [this.projectAccess.expenseWhere(user)],
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(search
        ? {
            OR: [
              { expenseNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.serialize(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string, user: AuthUserDto) {
    await this.projectAccess.assertCanAccessExpense(user, id);
    const expense = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: expenseInclude,
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const resolved = resolveExpenseStatus({
      currentStatus: expense.status,
      grossAmount: expense.grossAmount.toString(),
      paidAmount: expense.paidAmount.toString(),
      dueDate: expense.dueDate,
    });

    if (resolved !== expense.status) {
      const updated = await this.prisma.expense.update({
        where: { id },
        data: { status: resolved },
        include: expenseInclude,
      });
      return this.serialize(updated);
    }

    return this.serialize(expense);
  }

  async create(dto: CreateExpenseDto, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessOptionalProject(
      user,
      dto.projectId,
    );
    await this.assertProject(dto.projectId);
    await this.assertSupplier(dto.supplierId);

    if (dto.expenseNumber) {
      const clash = await this.prisma.expense.findFirst({
        where: { expenseNumber: dto.expenseNumber },
      });
      if (clash) {
        throw new ConflictException('Expense number already exists');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const currency = await resolveTransactionCurrency(tx, {
        explicit: dto.currency,
        projectId: dto.projectId,
      });
      // Afghanistan: no VAT — always 0%.
      const taxRate = '0';
      const amounts = this.computeTax(dto.netAmount, taxRate);
      this.assertCanWriteExpenseAmount(user, amounts.grossAmount, currency);
      const expenseNumber =
        dto.expenseNumber ?? (await this.nextExpenseNumber(tx));
      // Expenses are always recorded fully paid — no partial payment ledger.
      const status =
        dto.status === ExpenseStatus.CANCELLED
          ? ExpenseStatus.CANCELLED
          : ExpenseStatus.PAID;
      const paidAmount =
        status === ExpenseStatus.CANCELLED ? '0' : amounts.grossAmount;

      const row = await tx.expense.create({
        data: {
          expenseNumber,
          projectId: dto.projectId,
          category: this.normalizeCategory(dto.category),
          supplierId: dto.supplierId,
          description: dto.description,
          invoiceNumber: dto.invoiceNumber,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          netAmount: dto.netAmount,
          taxRate,
          taxAmount: amounts.taxAmount,
          grossAmount: amounts.grossAmount,
          paidAmount,
          currency,
          status,
          paymentDate:
            status === ExpenseStatus.PAID
              ? dto.paymentDate
                ? new Date(dto.paymentDate)
                : new Date()
              : dto.paymentDate
                ? new Date(dto.paymentDate)
                : undefined,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
        },
        include: expenseInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EXPENSE_CREATED',
          entityType: 'Expense',
          entityId: row.id,
          newValue: {
            expenseNumber: row.expenseNumber,
            netAmount: row.netAmount.toString(),
            status: row.status,
          },
        },
      });

      return this.serialize(row);
    });

    if (created.projectId) {
      await this.budgets
        .syncAndNotifyOverruns(created.projectId, actorId)
        .catch(() => undefined);
    }
    return created;
  }

  async update(id: string, dto: UpdateExpenseDto, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessExpense(user, id);
    const existing = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    if (dto.projectId !== undefined) {
      await this.projectAccess.assertCanAccessOptionalProject(
        user,
        dto.projectId,
      );
      await this.assertProject(dto.projectId);
    }
    if (dto.supplierId !== undefined) {
      await this.assertSupplier(dto.supplierId);
    }
    if (dto.expenseNumber && dto.expenseNumber !== existing.expenseNumber) {
      const clash = await this.prisma.expense.findFirst({
        where: { expenseNumber: dto.expenseNumber, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException('Expense number already exists');
      }
    }

    const netAmount = dto.netAmount ?? existing.netAmount.toString();
    // Afghanistan: no VAT — always 0%.
    const taxRate = '0';
    const amounts =
      dto.netAmount !== undefined ||
      !money(existing.taxRate).isZero() ||
      !money(existing.taxAmount).isZero()
        ? this.computeTax(netAmount, taxRate)
        : {
            taxAmount: '0',
            grossAmount: money(netAmount).toFixed(4),
          };

    let nextCurrency = existing.currency;
    if (dto.currency !== undefined) {
      nextCurrency = await resolveTransactionCurrency(this.prisma, {
        explicit: dto.currency,
        projectId:
          dto.projectId !== undefined ? dto.projectId : existing.projectId,
      });
    } else if (
      dto.projectId !== undefined &&
      dto.projectId !== existing.projectId
    ) {
      nextCurrency = await resolveTransactionCurrency(this.prisma, {
        projectId: dto.projectId,
      });
    }

    this.assertCanWriteExpenseAmount(user, amounts.grossAmount, nextCurrency);

    const dueDate =
      dto.dueDate === undefined
        ? existing.dueDate
        : dto.dueDate
          ? new Date(dto.dueDate)
          : null;
    const requestedStatus = dto.status ?? existing.status;
    const status =
      requestedStatus === ExpenseStatus.CANCELLED
        ? ExpenseStatus.CANCELLED
        : resolveExpenseStatus({
            currentStatus: ExpenseStatus.PAID,
            grossAmount: amounts.grossAmount,
            paidAmount: amounts.grossAmount,
            dueDate,
          });
    const paidAmount =
      status === ExpenseStatus.CANCELLED ? '0' : amounts.grossAmount;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.expense.update({
        where: { id },
        data: {
          expenseNumber: dto.expenseNumber,
          projectId: dto.projectId,
          category:
            dto.category !== undefined
              ? this.normalizeCategory(dto.category)
              : undefined,
          supplierId: dto.supplierId,
          description: dto.description,
          invoiceNumber: dto.invoiceNumber,
          invoiceDate:
            dto.invoiceDate === undefined
              ? undefined
              : dto.invoiceDate
                ? new Date(dto.invoiceDate)
                : null,
          dueDate:
            dto.dueDate === undefined
              ? undefined
              : dto.dueDate
                ? new Date(dto.dueDate)
                : null,
          netAmount: dto.netAmount,
          taxRate,
          taxAmount: amounts.taxAmount,
          grossAmount: amounts.grossAmount,
          paidAmount,
          currency: nextCurrency,
          status,
          paymentDate:
            dto.paymentDate === undefined
              ? status === ExpenseStatus.PAID && !existing.paymentDate
                ? new Date()
                : undefined
              : dto.paymentDate
                ? new Date(dto.paymentDate)
                : null,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
        },
        include: expenseInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EXPENSE_UPDATED',
          entityType: 'Expense',
          entityId: id,
          previousValue: {
            expenseNumber: existing.expenseNumber,
            status: existing.status,
            netAmount: existing.netAmount.toString(),
          },
          newValue: {
            expenseNumber: row.expenseNumber,
            status: row.status,
            netAmount: row.netAmount.toString(),
          },
        },
      });

      return this.serialize(row);
    });

    const projectIds = new Set(
      [existing.projectId, updated.projectId].filter((id): id is string =>
        Boolean(id),
      ),
    );
    for (const projectId of projectIds) {
      await this.budgets
        .syncAndNotifyOverruns(projectId, actorId)
        .catch(() => undefined);
    }
    return updated;
  }

  async approve(id: string, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessExpense(user, id);
    const existing = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: expenseInclude,
    });
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }
    if (existing.status === ExpenseStatus.CANCELLED) {
      throw new BadRequestException('Cannot approve a cancelled expense');
    }
    if (existing.status === ExpenseStatus.APPROVED) {
      return this.serialize(existing);
    }
    if (
      existing.status !== ExpenseStatus.DRAFT &&
      existing.status !== ExpenseStatus.PENDING
    ) {
      throw new BadRequestException(
        'Only draft or pending expenses can be approved',
      );
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: { status: ExpenseStatus.APPROVED },
        include: expenseInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EXPENSE_APPROVED',
          entityType: 'Expense',
          entityId: id,
          previousValue: { status: existing.status },
          newValue: { status: updated.status },
        },
      });

      const projectLabel = updated.project
        ? `${updated.project.projectNumber} — ${updated.project.name}`
        : 'no project';
      await this.notifications.notifyProjectManager(
        updated.projectId,
        {
          title: 'Expense approved',
          message: `${updated.expenseNumber} (${updated.description}) was approved · ${projectLabel}`,
          type: 'expense.approved',
          link: updated.projectId
            ? `/projects/${updated.projectId}?tab=expenses`
            : '/expenses',
        },
        { excludeUserId: actorId, tx },
      );
      if (!updated.projectId) {
        await this.notifications.createForRoles(
          [Role.ACCOUNTING, Role.MANAGEMENT],
          {
            title: 'Expense approved',
            message: `${updated.expenseNumber} (${updated.description}) was approved`,
            type: 'expense.approved',
            link: '/expenses',
          },
          { excludeUserId: actorId, tx },
        );
      }

      return this.serialize(updated);
    });

    if (approved.projectId) {
      await this.budgets
        .syncAndNotifyOverruns(approved.projectId, actorId)
        .catch(() => undefined);
    }
    return approved;
  }

  async remove(id: string, user: AuthUserDto) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only administrators can delete expenses');
    }
    const actorId = user.id;
    await this.projectAccess.assertCanAccessExpense(user, id);
    const existing = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EXPENSE_DELETED',
          entityType: 'Expense',
          entityId: id,
          previousValue: {
            expenseNumber: existing.expenseNumber,
            status: existing.status,
          },
        },
      });
    });

    if (existing.projectId) {
      await this.budgets
        .syncAndNotifyOverruns(existing.projectId, actorId)
        .catch(() => undefined);
    }

    return { success: true };
  }
}
