import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, InvoiceType, Prisma, Role } from '@prisma/client';
import {
  dateOnlyToUtcDate,
  money,
  reconcileInvoiceTotals,
  resolveInvoiceStatus,
  toDateOnlyString,
} from '@fbm/financial-core';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  type AuthUserDto,
} from '@fbm/shared';
import { ProjectAccessService } from '../authz/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BudgetsService } from '../budgets/budgets.service';
import { NumberingService } from '../common/numbering.service';
import { buildPdfBuffer } from '../common/pdf.util';
import type {
  CreateInvoiceDto,
  InvoiceItemDto,
} from './dto/create-invoice.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import {
  assertInvoiceDeletable,
  assertInvoiceFinancialEditAllowed,
} from './invoice-lifecycle';

const invoiceInclude = {
  project: { select: { id: true, projectNumber: true, name: true } },
  customer: { select: { id: true, companyName: true } },
  supplier: { select: { id: true, companyName: true } },
  subcontractor: { select: { id: true, companyName: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.InvoiceInclude;

const invoiceListInclude = {
  project: { select: { id: true, projectNumber: true, name: true } },
  customer: { select: { id: true, companyName: true } },
  supplier: { select: { id: true, companyName: true } },
  subcontractor: { select: { id: true, companyName: true } },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly budgets: BudgetsService,
    private readonly numbering: NumberingService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private async syncBudgetForInvoice(input: {
    type: InvoiceType;
    projectId: string | null | undefined;
    actorId: string;
  }) {
    if (input.type !== InvoiceType.SUPPLIER || !input.projectId) return;
    await this.budgets
      .syncAndNotifyOverruns(input.projectId, input.actorId)
      .catch(() => undefined);
  }

  private decimalToString(value: Prisma.Decimal | string | number): string {
    return value.toString();
  }

  private async notifyIfNewlyOverdue(
    invoice: {
      id: string;
      invoiceNumber: string;
      status: InvoiceStatus;
      projectId: string | null;
      project: { projectNumber: string; name: string } | null;
    },
    previousStatus: InvoiceStatus | null,
    actorId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (
      invoice.status !== InvoiceStatus.OVERDUE ||
      previousStatus === InvoiceStatus.OVERDUE
    ) {
      return;
    }

    const projectLabel = invoice.project
      ? `${invoice.project.projectNumber} — ${invoice.project.name}`
      : 'no project';
    const payload = {
      title: 'Invoice overdue',
      message: `${invoice.invoiceNumber} is overdue · ${projectLabel}`,
      type: 'invoice.overdue',
      link: invoice.projectId
        ? `/projects/${invoice.projectId}?tab=invoices`
        : '/invoices',
      dedupeKey: `invoice.overdue:${invoice.id}`,
    };

    await this.notifications.notifyProjectManager(invoice.projectId, payload, {
      excludeUserId: actorId,
      tx,
    });
    await this.notifications.createForRoles([Role.ACCOUNTING], payload, {
      excludeUserId: actorId,
      tx,
    });
  }

  private async nextInvoiceNumber(
    type: InvoiceType,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const year = new Date().getFullYear();
    const settings = await tx.companySettings.findFirst({
      select: { invoicePrefix: true },
    });
    const customerPrefix = (
      settings?.invoicePrefix?.trim() || 'INV'
    ).toUpperCase();
    const basePrefix = type === InvoiceType.CUSTOMER ? customerPrefix : 'SI';
    const prefix = `${basePrefix}-${year}-`;
    const sequenceKey = `invoice:${prefix}`;

    const latest = await tx.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    let minNext = 1;
    if (latest) {
      const part = latest.invoiceNumber.split('-').pop();
      minNext = (Number.parseInt(part ?? '0', 10) || 0) + 1;
    }
    await this.numbering.ensureAtLeast(sequenceKey, minNext, tx);
    const seq = await this.numbering.allocateNext(sequenceKey, tx);
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private computeTax(
    netAmount: string,
    taxRate: string,
    lines?: Array<{ netAmount: string }>,
  ) {
    try {
      const reconciled = reconcileInvoiceTotals({
        netAmount,
        taxRatePercent: taxRate,
        lines,
      });
      return {
        netAmount: reconciled.netAmount,
        taxAmount: reconciled.taxAmount,
        grossAmount: reconciled.grossAmount,
        taxRate: reconciled.taxRate,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invoice totals invalid',
      );
    }
  }

  private mapItems(items?: InvoiceItemDto[]) {
    if (!items?.length) return undefined;
    return items.map((item, index) => {
      const quantity = item.quantity ?? '1';
      const netAmount =
        item.netAmount ??
        money(quantity)
          .mul(money(item.unitPrice))
          .toDecimalPlaces(4)
          .toFixed(4);
      return {
        description: item.description,
        quantity,
        unitPrice: item.unitPrice,
        netAmount,
        sortOrder: item.sortOrder ?? index,
      };
    });
  }

  private serialize(
    invoice:
      | Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>
      | Prisma.InvoiceGetPayload<{ include: typeof invoiceListInclude }>,
  ) {
    const status = resolveInvoiceStatus({
      currentStatus: invoice.status,
      grossAmount: invoice.grossAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      dueDate: invoice.dueDate,
    });

    const items =
      'items' in invoice && Array.isArray(invoice.items)
        ? invoice.items.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: this.decimalToString(item.quantity),
            unitPrice: this.decimalToString(item.unitPrice),
            netAmount: this.decimalToString(item.netAmount),
            sortOrder: item.sortOrder,
          }))
        : [];

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      type: invoice.type,
      projectId: invoice.projectId,
      customerId: invoice.customerId,
      supplierId: invoice.supplierId,
      subcontractorId: invoice.subcontractorId,
      issueDate: toDateOnlyString(invoice.issueDate),
      dueDate: toDateOnlyString(invoice.dueDate),
      netAmount: this.decimalToString(invoice.netAmount),
      taxRate: this.decimalToString(invoice.taxRate),
      taxAmount: this.decimalToString(invoice.taxAmount),
      grossAmount: this.decimalToString(invoice.grossAmount),
      paidAmount: this.decimalToString(invoice.paidAmount),
      status,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      project: invoice.project,
      customer: invoice.customer,
      supplier: invoice.supplier,
      subcontractor: invoice.subcontractor,
      items,
    };
  }

  private async validateParty(
    type: InvoiceType,
    customerId?: string | null,
    supplierId?: string | null,
    subcontractorId?: string | null,
  ) {
    if (type === InvoiceType.CUSTOMER) {
      if (!customerId) {
        throw new BadRequestException(
          'customerId is required for CUSTOMER invoices',
        );
      }
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, deletedAt: null },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found');
      }
    }
    if (type === InvoiceType.SUPPLIER) {
      if (!supplierId && !subcontractorId) {
        throw new BadRequestException(
          'supplierId or subcontractorId is required for SUPPLIER invoices',
        );
      }
      if (supplierId) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { id: supplierId, deletedAt: null },
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found');
        }
      }
      if (subcontractorId) {
        const subcontractor = await this.prisma.subcontractor.findFirst({
          where: { id: subcontractorId, deletedAt: null },
        });
        if (!subcontractor) {
          throw new BadRequestException('Subcontractor not found');
        }
      }
    }
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

  async findAll(
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      type?: InvoiceType;
      projectId?: string;
      status?: InvoiceStatus;
    },
    user: AuthUserDto,
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      AND: [this.projectAccess.invoiceWhere(user)],
      ...(params.type ? { type: params.type } : {}),
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: invoiceListInclude,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
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
    await this.projectAccess.assertCanAccessInvoice(user, id);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const resolved = resolveInvoiceStatus({
      currentStatus: invoice.status,
      grossAmount: invoice.grossAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      dueDate: invoice.dueDate,
    });

    if (resolved !== invoice.status) {
      const updated = await this.prisma.invoice.update({
        where: { id },
        data: { status: resolved },
        include: invoiceInclude,
      });
      await this.notifyIfNewlyOverdue(updated, invoice.status, 'system');
      return this.serialize(updated);
    }

    return this.serialize(invoice);
  }

  async renderPdf(id: string, user: AuthUserDto) {
    await this.projectAccess.assertCanAccessInvoice(user, id);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const settings = await this.prisma.companySettings.findFirst();
    const data = this.serialize(invoice);

    const buffer = await buildPdfBuffer((doc) => {
      doc.fontSize(18).text(settings?.companyName ?? 'FBM Counter', {
        continued: false,
      });
      doc.moveDown(0.5);
      doc.fontSize(14).text(`Invoice ${data.invoiceNumber}`);
      doc.fontSize(10).fillColor('#555');
      doc.text(
        `Type: ${INVOICE_TYPE_LABELS[data.type] ?? data.type} · Status: ${INVOICE_STATUS_LABELS[data.status] ?? data.status}`,
      );
      doc.text(
        `Date: ${data.issueDate.slice(0, 10)} · Due: ${data.dueDate.slice(0, 10)}`,
      );
      if (data.customer) doc.text(`Customer: ${data.customer.companyName}`);
      if (data.supplier) doc.text(`Supplier: ${data.supplier.companyName}`);
      if (data.project) {
        doc.text(
          `Project: ${data.project.projectNumber} — ${data.project.name}`,
        );
      }
      doc.moveDown();
      doc.fillColor('#000').fontSize(11).text('Line items');
      doc.moveDown(0.3);
      for (const item of data.items) {
        doc
          .fontSize(10)
          .text(
            `${item.description} · Qty ${item.quantity} · ${item.netAmount} EUR`,
          );
      }
      doc.moveDown();
      doc.fontSize(11).text(`Net: ${data.netAmount} EUR`);
      doc.text(`VAT (${data.taxRate}%): ${data.taxAmount} EUR`);
      doc.fontSize(12).text(`Gross: ${data.grossAmount} EUR`);
      doc.text(`Paid: ${data.paidAmount} EUR`);
      if (data.notes) {
        doc.moveDown();
        doc.fontSize(10).fillColor('#555').text(`Note: ${data.notes}`);
      }
    });

    return {
      filename: `${data.invoiceNumber}.pdf`,
      buffer,
    };
  }

  async create(dto: CreateInvoiceDto, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessOptionalProject(
      user,
      dto.projectId,
    );
    await this.validateParty(
      dto.type,
      dto.customerId,
      dto.supplierId,
      dto.subcontractorId,
    );
    await this.assertProject(dto.projectId);

    if (dto.invoiceNumber) {
      const clash = await this.prisma.invoice.findFirst({
        where: { invoiceNumber: dto.invoiceNumber },
      });
      if (clash) {
        throw new ConflictException('Invoice number already exists');
      }
    }

    const items = this.mapItems(dto.items);

    const created = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.companySettings.findFirst({
        select: { defaultVatRate: true },
      });
      const taxRate =
        dto.taxRate ?? settings?.defaultVatRate.toString() ?? '19';
      const amounts = this.computeTax(
        dto.netAmount,
        taxRate,
        items?.map((item) => ({ netAmount: item.netAmount })),
      );
      let invoiceNumber =
        dto.invoiceNumber ?? (await this.nextInvoiceNumber(dto.type, tx));

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const row = await tx.invoice.create({
            data: {
              invoiceNumber,
              type: dto.type,
              projectId: dto.projectId,
              customerId:
                dto.type === InvoiceType.CUSTOMER ? dto.customerId : null,
              supplierId:
                dto.type === InvoiceType.SUPPLIER
                  ? (dto.supplierId ?? null)
                  : null,
              subcontractorId:
                dto.type === InvoiceType.SUPPLIER
                  ? (dto.subcontractorId ?? null)
                  : null,
              issueDate: dateOnlyToUtcDate(dto.issueDate),
              dueDate: dateOnlyToUtcDate(dto.dueDate),
              netAmount: amounts.netAmount,
              taxRate: amounts.taxRate,
              taxAmount: amounts.taxAmount,
              grossAmount: amounts.grossAmount,
              paidAmount: '0',
              status: dto.status ?? InvoiceStatus.DRAFT,
              paymentTerms: dto.paymentTerms,
              notes: dto.notes,
              ...(items ? { items: { create: items } } : {}),
            },
            include: invoiceInclude,
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'INVOICE_CREATED',
              entityType: 'Invoice',
              entityId: row.id,
              newValue: {
                invoiceNumber: row.invoiceNumber,
                type: row.type,
                status: row.status,
                netAmount: row.netAmount.toString(),
              },
            },
          });

          const resolved = resolveInvoiceStatus({
            currentStatus: row.status,
            grossAmount: row.grossAmount.toString(),
            paidAmount: row.paidAmount.toString(),
            dueDate: row.dueDate,
          });
          const finalInvoice =
            resolved !== row.status
              ? await tx.invoice.update({
                  where: { id: row.id },
                  data: { status: resolved },
                  include: invoiceInclude,
                })
              : row;

          await this.notifyIfNewlyOverdue(finalInvoice, null, actorId, tx);

          return this.serialize(finalInvoice);
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            !dto.invoiceNumber
          ) {
            invoiceNumber = await this.nextInvoiceNumber(dto.type, tx);
            continue;
          }
          throw error;
        }
      }
      throw new ConflictException('Could not allocate a unique invoice number');
    });

    await this.syncBudgetForInvoice({
      type: created.type,
      projectId: created.projectId,
      actorId,
    });
    return created;
  }

  async update(id: string, dto: UpdateInvoiceDto, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessInvoice(user, id);
    const existing = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    try {
      assertInvoiceFinancialEditAllowed(
        existing.status,
        dto as unknown as Record<string, unknown>,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invoice update rejected',
      );
    }

    const type = dto.type ?? existing.type;
    const customerId =
      dto.customerId !== undefined ? dto.customerId : existing.customerId;
    const supplierId =
      dto.supplierId !== undefined ? dto.supplierId : existing.supplierId;
    const subcontractorId =
      dto.subcontractorId !== undefined
        ? dto.subcontractorId
        : existing.subcontractorId;

    await this.validateParty(type, customerId, supplierId, subcontractorId);
    if (dto.projectId !== undefined) {
      await this.projectAccess.assertCanAccessOptionalProject(
        user,
        dto.projectId,
      );
      await this.assertProject(dto.projectId);
    }

    if (dto.invoiceNumber && dto.invoiceNumber !== existing.invoiceNumber) {
      const clash = await this.prisma.invoice.findFirst({
        where: { invoiceNumber: dto.invoiceNumber, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException('Invoice number already exists');
      }
    }

    const paymentAggregate = await this.prisma.payment.aggregate({
      where: { invoiceId: id, deletedAt: null },
      _sum: { amount: true },
    });
    const paidAmount = (paymentAggregate._sum.amount ?? money(0)).toString();

    const netAmount = dto.netAmount ?? existing.netAmount.toString();
    const taxRate = dto.taxRate ?? existing.taxRate.toString();
    const items = this.mapItems(dto.items);
    const amounts =
      dto.netAmount !== undefined ||
      dto.taxRate !== undefined ||
      items !== undefined
        ? this.computeTax(
            netAmount,
            taxRate,
            items?.map((item) => ({ netAmount: item.netAmount })),
          )
        : {
            netAmount: existing.netAmount.toString(),
            taxAmount: existing.taxAmount.toString(),
            grossAmount: existing.grossAmount.toString(),
            taxRate: existing.taxRate.toString(),
          };

    const dueDate = dto.dueDate
      ? dateOnlyToUtcDate(dto.dueDate)
      : existing.dueDate;
    const issueDate = dto.issueDate
      ? dateOnlyToUtcDate(dto.issueDate)
      : existing.issueDate;
    const requestedStatus = dto.status ?? existing.status;
    const status = resolveInvoiceStatus({
      currentStatus: requestedStatus,
      grossAmount: amounts.grossAmount,
      paidAmount,
      dueDate,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }

      const row = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: dto.invoiceNumber,
          type: dto.type,
          projectId: dto.projectId,
          customerId:
            type === InvoiceType.CUSTOMER
              ? customerId
              : dto.type
                ? null
                : undefined,
          supplierId:
            type === InvoiceType.SUPPLIER
              ? supplierId
              : dto.type
                ? null
                : undefined,
          subcontractorId:
            type === InvoiceType.SUPPLIER
              ? subcontractorId
              : dto.type
                ? null
                : undefined,
          issueDate: dto.issueDate ? issueDate : undefined,
          dueDate: dto.dueDate ? dueDate : undefined,
          netAmount: amounts.netAmount,
          taxRate: amounts.taxRate,
          taxAmount: amounts.taxAmount,
          grossAmount: amounts.grossAmount,
          paidAmount,
          status,
          paymentTerms: dto.paymentTerms,
          notes: dto.notes,
          ...(items ? { items: { create: items } } : {}),
        },
        include: invoiceInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'INVOICE_UPDATED',
          entityType: 'Invoice',
          entityId: id,
          previousValue: {
            invoiceNumber: existing.invoiceNumber,
            status: existing.status,
            netAmount: existing.netAmount.toString(),
          },
          newValue: {
            invoiceNumber: row.invoiceNumber,
            status: row.status,
            netAmount: row.netAmount.toString(),
          },
        },
      });

      await this.notifyIfNewlyOverdue(row, existing.status, actorId, tx);

      return this.serialize(row);
    });

    const projectsToSync = new Set<string>();
    if (existing.type === InvoiceType.SUPPLIER && existing.projectId) {
      projectsToSync.add(existing.projectId);
    }
    if (updated.type === InvoiceType.SUPPLIER && updated.projectId) {
      projectsToSync.add(updated.projectId);
    }
    for (const projectId of projectsToSync) {
      await this.syncBudgetForInvoice({
        type: InvoiceType.SUPPLIER,
        projectId,
        actorId,
      });
    }

    return updated;
  }

  async remove(id: string, user: AuthUserDto) {
    const actorId = user.id;
    await this.projectAccess.assertCanAccessInvoice(user, id);
    const existing = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    const paymentCount = await this.prisma.payment.count({
      where: { invoiceId: id, deletedAt: null },
    });

    try {
      assertInvoiceDeletable({
        status: existing.status,
        paymentCount,
      });
    } catch (error) {
      throw new ConflictException(
        error instanceof Error ? error.message : 'Invoice cannot be deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'INVOICE_DELETED',
          entityType: 'Invoice',
          entityId: id,
          previousValue: {
            invoiceNumber: existing.invoiceNumber,
            status: existing.status,
          },
        },
      });
    });

    await this.syncBudgetForInvoice({
      type: existing.type,
      projectId: existing.projectId,
      actorId,
    });

    return { success: true };
  }
}
