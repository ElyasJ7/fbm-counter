import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PaymentType,
  Prisma,
} from '@prisma/client';
import {
  applyPaymentToInvoice,
  dateOnlyToUtcDate,
  money,
  resolveInvoiceStatus,
  toDateOnlyString,
  type InvoiceStatusName,
} from '@fbm/financial-core';
import type { AuthUserDto } from '@fbm/shared';
import { ProjectAccessService } from '../authz/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NumberingService } from '../common/numbering.service';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import { lockInvoiceForUpdate, sumValidPaymentAmount } from './payment-locking';

const paymentInclude = {
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      type: true,
      status: true,
    },
  },
  project: { select: { id: true, projectNumber: true, name: true } },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgets: BudgetsService,
    private readonly notifications: NotificationsService,
    private readonly numbering: NumberingService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private async syncBudgetAfterSupplierPayment(
    invoice: { type: string; projectId: string | null },
    actorId: string,
  ) {
    if (invoice.type !== InvoiceType.SUPPLIER || !invoice.projectId) return;
    await this.budgets
      .syncAndNotifyOverruns(invoice.projectId, actorId)
      .catch(() => undefined);
  }

  private decimalToString(value: Prisma.Decimal | string | number): string {
    return value.toString();
  }

  private async nextPaymentNumber(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const sequenceKey = `payment:${prefix}`;
    const latest = await tx.payment.findFirst({
      where: { paymentNumber: { startsWith: prefix } },
      orderBy: { paymentNumber: 'desc' },
      select: { paymentNumber: true },
    });
    let minNext = 1;
    if (latest) {
      const part = latest.paymentNumber.split('-').pop();
      minNext = (Number.parseInt(part ?? '0', 10) || 0) + 1;
    }
    await this.numbering.ensureAtLeast(sequenceKey, minNext, tx);
    const seq = await this.numbering.allocateNext(sequenceKey, tx);
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private serialize(
    payment: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>,
  ) {
    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      invoiceId: payment.invoiceId,
      projectId: payment.projectId,
      paymentDate: toDateOnlyString(payment.paymentDate),
      amount: this.decimalToString(payment.amount),
      type: payment.type,
      method: payment.method,
      reference: payment.reference,
      bankReference: payment.bankReference,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      invoice: payment.invoice,
      project: payment.project,
    };
  }

  async findAll(
    params: {
      page?: number;
      pageSize?: number;
      invoiceId?: string;
      projectId?: string;
    },
    user: AuthUserDto,
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      AND: [this.projectAccess.paymentWhere(user)],
      ...(params.invoiceId ? { invoiceId: params.invoiceId } : {}),
      ...(params.projectId ? { projectId: params.projectId } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
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
    await this.projectAccess.assertCanAccessPayment(user, id);
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: paymentInclude,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.serialize(payment);
  }

  async create(dto: CreatePaymentDto, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessInvoice(user, dto.invoiceId);
    if (dto.projectId) {
      await this.projectAccess.assertCanAccessOptionalProject(
        user,
        dto.projectId,
      );
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await lockInvoiceForUpdate(tx, dto.invoiceId);
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (
        invoice.status === InvoiceStatus.CANCELLED ||
        invoice.status === InvoiceStatus.DRAFT
      ) {
        throw new BadRequestException(
          'Cannot apply payment to cancelled or draft invoices',
        );
      }

      if (dto.projectId) {
        const project = await tx.project.findFirst({
          where: { id: dto.projectId, deletedAt: null },
        });
        if (!project) {
          throw new BadRequestException('Project not found');
        }
      }

      const currentPaid = await sumValidPaymentAmount(tx, invoice.id);

      let applied;
      try {
        applied = applyPaymentToInvoice({
          grossAmount: invoice.grossAmount.toString(),
          paidAmount: currentPaid,
          paymentAmount: dto.amount,
          currentStatus: invoice.status as InvoiceStatusName,
          dueDate: invoice.dueDate,
        });
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid payment amount',
        );
      }

      const paymentType =
        invoice.type === InvoiceType.CUSTOMER
          ? PaymentType.INCOMING
          : PaymentType.OUTGOING;

      const paymentNumber = await this.nextPaymentNumber(tx);
      const projectId = dto.projectId ?? invoice.projectId ?? undefined;

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          projectId,
          paymentDate: dateOnlyToUtcDate(dto.paymentDate),
          amount: dto.amount,
          type: paymentType,
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          reference: dto.reference,
          bankReference: dto.bankReference,
          notes: dto.notes,
        },
        include: paymentInclude,
      });

      const derivedPaid = await sumValidPaymentAmount(tx, invoice.id);
      if (!money(derivedPaid).equals(money(applied.newPaidAmount))) {
        throw new BadRequestException(
          'Payment total mismatch after insert; aborting',
        );
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: derivedPaid,
          status: applied.status,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PAYMENT_CREATED',
          entityType: 'Payment',
          entityId: payment.id,
          newValue: {
            paymentNumber: payment.paymentNumber,
            invoiceId: invoice.id,
            amount: payment.amount.toString(),
            invoiceStatus: applied.status,
          },
        },
      });

      return {
        payment: this.serialize(payment),
        invoice,
        invoiceStatus: applied.status,
      };
    });

    await this.syncBudgetAfterSupplierPayment(result.invoice, actorId);
    if (result.invoiceStatus !== InvoiceStatus.OVERDUE) {
      await this.notifications.clearInvoiceOverdueDedupe(result.invoice.id);
    }
    return result.payment;
  }

  async remove(id: string, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessPayment(user, id);
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const invoice = await lockInvoiceForUpdate(tx, payment.invoiceId);
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      await tx.payment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      const newPaidAmount = await sumValidPaymentAmount(tx, invoice.id);

      const status = resolveInvoiceStatus({
        currentStatus:
          invoice.status === InvoiceStatus.DRAFT
            ? 'OPEN'
            : (invoice.status as InvoiceStatusName),
        grossAmount: invoice.grossAmount.toString(),
        paidAmount: newPaidAmount,
        dueDate: invoice.dueDate,
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PAYMENT_DELETED',
          entityType: 'Payment',
          entityId: id,
          previousValue: {
            paymentNumber: payment.paymentNumber,
            amount: payment.amount.toString(),
            invoicePaidAmount: invoice.paidAmount.toString(),
          },
          newValue: {
            invoicePaidAmount: newPaidAmount,
            invoiceStatus: status,
          },
        },
      });

      return { success: true as const, invoice };
    });

    await this.syncBudgetAfterSupplierPayment(result.invoice, actorId);
    return { success: result.success };
  }
}
