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
  money,
  resolveInvoiceStatus,
  type InvoiceStatusName,
} from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePaymentDto } from './dto/create-payment.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  private decimalToString(value: Prisma.Decimal | string | number): string {
    return value.toString();
  }

  private async nextPaymentNumber(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const latest = await tx.payment.findFirst({
      where: { paymentNumber: { startsWith: prefix } },
      orderBy: { paymentNumber: 'desc' },
      select: { paymentNumber: true },
    });
    let seq = 1;
    if (latest) {
      const part = latest.paymentNumber.split('-').pop();
      seq = (Number(part) || 0) + 1;
    }
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
      paymentDate: payment.paymentDate.toISOString(),
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

  async findAll(params: {
    page?: number;
    pageSize?: number;
    invoiceId?: string;
    projectId?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
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

  async findOne(id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, deletedAt: null },
      include: paymentInclude,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.serialize(payment);
  }

  async create(dto: CreatePaymentDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, deletedAt: null },
      });
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

      let applied;
      try {
        applied = applyPaymentToInvoice({
          grossAmount: invoice.grossAmount.toString(),
          paidAmount: invoice.paidAmount.toString(),
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
          paymentDate: new Date(dto.paymentDate),
          amount: dto.amount,
          type: paymentType,
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          reference: dto.reference,
          bankReference: dto.bankReference,
          notes: dto.notes,
        },
        include: paymentInclude,
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: applied.newPaidAmount,
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

      return this.serialize(payment);
    });
  }

  async remove(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id, deletedAt: null },
      });
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const invoice = await tx.invoice.findFirst({
        where: { id: payment.invoiceId, deletedAt: null },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const newPaid = money(invoice.paidAmount)
        .minus(payment.amount)
        .toDecimalPlaces(4);
      if (newPaid.isNegative()) {
        throw new BadRequestException(
          'Cannot reverse payment: invoice paid amount would become negative',
        );
      }

      const newPaidAmount = newPaid.toFixed(4);
      const status = resolveInvoiceStatus({
        currentStatus:
          invoice.status === InvoiceStatus.DRAFT
            ? 'OPEN'
            : (invoice.status as InvoiceStatusName),
        grossAmount: invoice.grossAmount.toString(),
        paidAmount: newPaidAmount,
        dueDate: invoice.dueDate,
      });

      await tx.payment.update({
        where: { id },
        data: { deletedAt: new Date() },
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

      return { success: true };
    });
  }
}
