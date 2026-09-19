import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubcontractorTrade } from '@prisma/client';
import { money } from '@fbm/financial-core';
import type { AuthUserDto } from '@fbm/shared';
import { ProjectAccessService } from '../authz/project-access.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignProjectDto } from './dto/assign-project.dto';
import type { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import type { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';

const OPEN_INVOICE_STATUSES = [
  'SENT',
  'OPEN',
  'PARTIALLY_PAID',
  'OVERDUE',
] as const;

@Injectable()
export class SubcontractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private moneyStr(value: ReturnType<typeof money>) {
    return value.toDecimalPlaces(4).toFixed(4);
  }

  private invoiceTotals(
    invoices: Array<{
      status: string;
      grossAmount: Prisma.Decimal;
      paidAmount: Prisma.Decimal;
    }>,
  ) {
    let paidAmount = money(0);
    let outstandingBalance = money(0);
    let totalInvoiced = money(0);

    for (const invoice of invoices) {
      totalInvoiced = totalInvoiced.plus(invoice.grossAmount);
      paidAmount = paidAmount.plus(invoice.paidAmount);
      const remaining = money(invoice.grossAmount).minus(invoice.paidAmount);
      if (
        remaining.greaterThan(0) &&
        OPEN_INVOICE_STATUSES.includes(
          invoice.status as (typeof OPEN_INVOICE_STATUSES)[number],
        )
      ) {
        outstandingBalance = outstandingBalance.plus(remaining);
      }
    }

    return {
      totalPurchases: this.moneyStr(totalInvoiced),
      paidAmount: this.moneyStr(paidAmount),
      outstandingBalance: this.moneyStr(outstandingBalance),
    };
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    trade?: SubcontractorTrade;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.SubcontractorWhereInput = {
      deletedAt: null,
      ...(params.trade ? { trade: params.trade } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { contactPerson: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.subcontractor.count({ where }),
      this.prisma.subcontractor.findMany({
        where,
        orderBy: { companyName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { projects: true, invoices: true } },
        },
      }),
    ]);

    return {
      data: data.map((row) => ({
        ...row,
        contractValue: row.contractValue.toString(),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string, user: AuthUserDto) {
    const invoiceAccess = this.projectAccess.invoiceWhere(user);

    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id, deletedAt: null },
      include: {
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectNumber: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          where: { deletedAt: null, AND: [invoiceAccess] },
          orderBy: { issueDate: 'desc' },
          take: 50,
          include: {
            project: {
              select: { id: true, name: true, projectNumber: true },
            },
          },
        },
      },
    });

    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    const allInvoices = await this.prisma.invoice.findMany({
      where: {
        subcontractorId: id,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        AND: [invoiceAccess],
      },
      select: { status: true, grossAmount: true, paidAmount: true },
    });

    const projectContractSum = subcontractor.projects.reduce(
      (sum, link) => sum.plus(link.contractValue),
      money(0),
    );

    return {
      id: subcontractor.id,
      companyName: subcontractor.companyName,
      contactPerson: subcontractor.contactPerson,
      trade: subcontractor.trade,
      email: subcontractor.email,
      phone: subcontractor.phone,
      street: subcontractor.street,
      postalCode: subcontractor.postalCode,
      city: subcontractor.city,
      country: subcontractor.country,
      vatId: subcontractor.vatId,
      taxNumber: subcontractor.taxNumber,
      contractValue: subcontractor.contractValue.toString(),
      notes: subcontractor.notes,
      createdAt: subcontractor.createdAt,
      updatedAt: subcontractor.updatedAt,
      projects: subcontractor.projects.map((link) => ({
        id: link.id,
        projectId: link.projectId,
        contractValue: link.contractValue.toString(),
        notes: link.notes,
        createdAt: link.createdAt,
        project: link.project,
      })),
      invoices: subcontractor.invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        status: invoice.status,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        netAmount: invoice.netAmount.toString(),
        grossAmount: invoice.grossAmount.toString(),
        paidAmount: invoice.paidAmount.toString(),
        projectId: invoice.projectId,
        project: invoice.project,
      })),
      totals: {
        assignedContractValue: this.moneyStr(projectContractSum),
        ...this.invoiceTotals(allInvoices),
      },
    };
  }

  create(dto: CreateSubcontractorDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const subcontractor = await tx.subcontractor.create({
        data: {
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          trade: dto.trade ?? SubcontractorTrade.OTHER,
          email: dto.email,
          phone: dto.phone,
          street: dto.street,
          postalCode: dto.postalCode,
          city: dto.city,
          country: dto.country ?? 'DE',
          vatId: dto.vatId,
          taxNumber: dto.taxNumber,
          contractValue: dto.contractValue ?? '0',
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBCONTRACTOR_CREATED',
          entityType: 'Subcontractor',
          entityId: subcontractor.id,
          newValue: {
            companyName: subcontractor.companyName,
            trade: subcontractor.trade,
          },
        },
      });

      return {
        ...subcontractor,
        contractValue: subcontractor.contractValue.toString(),
      };
    });
  }

  async update(id: string, dto: UpdateSubcontractorDto, actorId: string) {
    const existing = await this.prisma.subcontractor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Subcontractor not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const subcontractor = await tx.subcontractor.update({
        where: { id },
        data: {
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          trade: dto.trade,
          email: dto.email,
          phone: dto.phone,
          street: dto.street,
          postalCode: dto.postalCode,
          city: dto.city,
          country: dto.country,
          vatId: dto.vatId,
          taxNumber: dto.taxNumber,
          contractValue: dto.contractValue,
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBCONTRACTOR_UPDATED',
          entityType: 'Subcontractor',
          entityId: id,
          previousValue: {
            companyName: existing.companyName,
            trade: existing.trade,
          },
          newValue: {
            companyName: subcontractor.companyName,
            trade: subcontractor.trade,
          },
        },
      });

      return {
        ...subcontractor,
        contractValue: subcontractor.contractValue.toString(),
      };
    });
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.subcontractor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Subcontractor not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subcontractor.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBCONTRACTOR_DELETED',
          entityType: 'Subcontractor',
          entityId: id,
          previousValue: {
            companyName: existing.companyName,
            trade: existing.trade,
          },
        },
      });
    });

    return { success: true };
  }

  async assignProject(id: string, dto: AssignProjectDto, actorId: string) {
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, deletedAt: null },
    });
    if (!project) {
      throw new BadRequestException('Project not found');
    }

    const existing = await this.prisma.projectSubcontractor.findUnique({
      where: {
        projectId_subcontractorId: {
          projectId: dto.projectId,
          subcontractorId: id,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Subcontractor is already assigned to this project',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const link = await tx.projectSubcontractor.create({
        data: {
          projectId: dto.projectId,
          subcontractorId: id,
          contractValue: dto.contractValue ?? '0',
          notes: dto.notes,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
              status: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBCONTRACTOR_PROJECT_ASSIGNED',
          entityType: 'ProjectSubcontractor',
          entityId: link.id,
          newValue: {
            subcontractorId: id,
            projectId: dto.projectId,
            contractValue: link.contractValue.toString(),
          },
        },
      });

      return {
        id: link.id,
        projectId: link.projectId,
        subcontractorId: link.subcontractorId,
        contractValue: link.contractValue.toString(),
        notes: link.notes,
        createdAt: link.createdAt,
        project: link.project,
      };
    });
  }

  async unassignProject(id: string, projectId: string, actorId: string) {
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!subcontractor) {
      throw new NotFoundException('Subcontractor not found');
    }

    const link = await this.prisma.projectSubcontractor.findUnique({
      where: {
        projectId_subcontractorId: {
          projectId,
          subcontractorId: id,
        },
      },
    });
    if (!link) {
      throw new NotFoundException('Project assignment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.projectSubcontractor.delete({ where: { id: link.id } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBCONTRACTOR_PROJECT_UNASSIGNED',
          entityType: 'ProjectSubcontractor',
          entityId: link.id,
          previousValue: {
            subcontractorId: id,
            projectId,
            contractValue: link.contractValue.toString(),
          },
        },
      });
    });

    return { success: true };
  }
}
