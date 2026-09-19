import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUserDto, Role } from '@fbm/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Central project-scope authorization (H3).
 *
 * Permission checks remain in RolesGuard.
 * This service enforces object scope: PROJECT_MANAGER may only access
 * projects where Project.projectManagerId === user.id (and linked data).
 *
 * Company-wide roles: ADMIN, MANAGEMENT, ACCOUNTING, VIEWER.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Roles that see all company projects. */
  isCompanyWide(role: Role): boolean {
    return role !== 'PROJECT_MANAGER';
  }

  isScoped(role: Role): boolean {
    return role === 'PROJECT_MANAGER';
  }

  /** Prisma filter for Project rows. Empty object = no extra restriction. */
  projectWhere(user: AuthUserDto): Prisma.ProjectWhereInput {
    if (this.isCompanyWide(user.role)) return {};
    return { projectManagerId: user.id };
  }

  /**
   * Filter for entities with optional `projectId` / nested `project`.
   * Scoped users only see rows linked to their assigned projects.
   * Unscoped (null projectId) rows are hidden from PROJECT_MANAGER.
   */
  linkedProjectWhere(user: AuthUserDto): Prisma.ProjectWhereInput {
    return this.projectWhere(user);
  }

  invoiceWhere(user: AuthUserDto): Prisma.InvoiceWhereInput {
    if (this.isCompanyWide(user.role)) return {};
    return { project: { is: { ...this.projectWhere(user), deletedAt: null } } };
  }

  expenseWhere(user: AuthUserDto): Prisma.ExpenseWhereInput {
    if (this.isCompanyWide(user.role)) return {};
    return { project: { is: { ...this.projectWhere(user), deletedAt: null } } };
  }

  paymentWhere(user: AuthUserDto): Prisma.PaymentWhereInput {
    if (this.isCompanyWide(user.role)) return {};
    return {
      OR: [
        { project: { is: { ...this.projectWhere(user), deletedAt: null } } },
        {
          invoice: {
            is: {
              project: { is: { ...this.projectWhere(user), deletedAt: null } },
            },
          },
        },
      ],
    };
  }

  documentWhere(user: AuthUserDto): Prisma.DocumentWhereInput {
    if (this.isCompanyWide(user.role)) return {};
    return { project: { is: { ...this.projectWhere(user), deletedAt: null } } };
  }

  budgetLineWhere(user: AuthUserDto): Prisma.BudgetLineWhereInput {
    if (this.isCompanyWide(user.role)) return {};
    return { project: { is: { ...this.projectWhere(user), deletedAt: null } } };
  }

  /**
   * Assert the user may access a project by id.
   * Throws NotFound for missing projects (avoid leaking existence to PMs via 403 vs 404 —
   * we use Forbidden for known-denied when project exists but unassigned, NotFound when missing).
   */
  async assertCanAccessProject(
    user: AuthUserDto,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, projectManagerId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (this.isCompanyWide(user.role)) return;
    if (project.projectManagerId !== user.id) {
      throw new ForbiddenException('Project access denied');
    }
  }

  /**
   * For optional projectId on create/update/read of linked entities:
   * company-wide roles always pass; PROJECT_MANAGER must have an assigned project.
   */
  async assertCanAccessOptionalProject(
    user: AuthUserDto,
    projectId: string | null | undefined,
  ): Promise<void> {
    if (this.isCompanyWide(user.role)) return;
    if (!projectId) {
      throw new ForbiddenException(
        'PROJECT_MANAGER requires an assigned project',
      );
    }
    await this.assertCanAccessProject(user, projectId);
  }

  async assertCanAccessInvoice(
    user: AuthUserDto,
    invoiceId: string,
  ): Promise<{ id: string; projectId: string | null }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    await this.assertCanAccessOptionalProject(user, invoice.projectId);
    return invoice;
  }

  async assertCanAccessExpense(
    user: AuthUserDto,
    expenseId: string,
  ): Promise<{ id: string; projectId: string | null }> {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    await this.assertCanAccessOptionalProject(user, expense.projectId);
    return expense;
  }

  async assertCanAccessPayment(
    user: AuthUserDto,
    paymentId: string,
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, deletedAt: null },
      select: {
        id: true,
        projectId: true,
        invoice: { select: { projectId: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const projectId = payment.projectId ?? payment.invoice.projectId;
    await this.assertCanAccessOptionalProject(user, projectId);
  }

  async assertCanAccessDocument(
    user: AuthUserDto,
    documentId: string,
  ): Promise<{ id: string; projectId: string | null }> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    await this.assertCanAccessOptionalProject(user, document.projectId);
    return document;
  }

  /** Accessible project ids for aggregates; null means all (company-wide). */
  async accessibleProjectIds(user: AuthUserDto): Promise<string[] | null> {
    if (this.isCompanyWide(user.role)) return null;
    const rows = await this.prisma.project.findMany({
      where: { deletedAt: null, projectManagerId: user.id },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
