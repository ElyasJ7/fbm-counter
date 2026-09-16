import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { ProjectFinanceService } from '../finance/project-finance.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

const projectListInclude = {
  customer: { select: { id: true, companyName: true } },
  projectManager: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.ProjectInclude;

const projectDetailInclude = {
  customer: true,
  projectManager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectFinance: ProjectFinanceService,
  ) {}

  private decimalToString(value: Prisma.Decimal | string | number): string {
    return value.toString();
  }

  private serializeListItem(
    project: Prisma.ProjectGetPayload<{ include: typeof projectListInclude }>,
  ) {
    return {
      id: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      status: project.status,
      contractValue: this.decimalToString(project.contractValue),
      currentBudget: this.decimalToString(project.currentBudget),
      currency: project.currency,
      progressPercent: project.progressPercent,
      startDate: project.startDate?.toISOString() ?? null,
      expectedCompletionDate:
        project.expectedCompletionDate?.toISOString() ?? null,
      customer: project.customer,
      projectManager: project.projectManager,
    };
  }

  private async serializeDetail(
    project: Prisma.ProjectGetPayload<{ include: typeof projectDetailInclude }>,
  ) {
    const overview = await this.projectFinance.buildOverview(project);
    return {
      ...this.serializeListItem({
        ...project,
        customer: {
          id: project.customer.id,
          companyName: project.customer.companyName,
        },
        projectManager: project.projectManager
          ? {
              id: project.projectManager.id,
              firstName: project.projectManager.firstName,
              lastName: project.projectManager.lastName,
            }
          : null,
      }),
      description: project.description,
      customerContact: project.customerContact,
      siteStreet: project.siteStreet,
      sitePostalCode: project.sitePostalCode,
      siteCity: project.siteCity,
      siteCountry: project.siteCountry,
      actualCompletionDate:
        project.actualCompletionDate?.toISOString() ?? null,
      initialBudget: this.decimalToString(project.initialBudget),
      notes: project.notes,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      customer: {
        ...project.customer,
        createdAt: project.customer.createdAt.toISOString(),
        updatedAt: project.customer.updatedAt.toISOString(),
      },
      overview,
    };
  }

  private async assertCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    return customer;
  }

  private async assertManagerExists(projectManagerId?: string | null) {
    if (!projectManagerId) return;
    const manager = await this.prisma.user.findFirst({
      where: {
        id: projectManagerId,
        deletedAt: null,
        status: 'ACTIVE',
        role: { in: ['ADMIN', 'MANAGEMENT', 'PROJECT_MANAGER'] },
      },
    });
    if (!manager) {
      throw new BadRequestException('Project manager not found or not eligible');
    }
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: ProjectStatus;
    customerId?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { projectNumber: { contains: search, mode: 'insensitive' } },
              {
                customer: {
                  companyName: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: projectListInclude,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.serializeListItem(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: projectDetailInclude,
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.serializeDetail(project);
  }

  async create(dto: CreateProjectDto, actorId: string) {
    await this.assertCustomerExists(dto.customerId);
    await this.assertManagerExists(dto.projectManagerId);

    const existingNumber = await this.prisma.project.findFirst({
      where: { projectNumber: dto.projectNumber, deletedAt: null },
    });
    if (existingNumber) {
      throw new ConflictException('Project number already exists');
    }

    const currentBudget = dto.currentBudget ?? dto.initialBudget;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          projectNumber: dto.projectNumber,
          name: dto.name,
          description: dto.description,
          customerId: dto.customerId,
          customerContact: dto.customerContact,
          projectManagerId: dto.projectManagerId,
          siteStreet: dto.siteStreet,
          sitePostalCode: dto.sitePostalCode,
          siteCity: dto.siteCity,
          siteCountry: dto.siteCountry ?? 'DE',
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          expectedCompletionDate: dto.expectedCompletionDate
            ? new Date(dto.expectedCompletionDate)
            : undefined,
          actualCompletionDate: dto.actualCompletionDate
            ? new Date(dto.actualCompletionDate)
            : undefined,
          status: dto.status ?? ProjectStatus.PLANNING,
          contractValue: dto.contractValue,
          initialBudget: dto.initialBudget,
          currentBudget,
          currency: dto.currency ?? 'EUR',
          progressPercent: dto.progressPercent ?? 0,
          notes: dto.notes,
        },
        include: projectDetailInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PROJECT_CREATED',
          entityType: 'Project',
          entityId: created.id,
          newValue: {
            projectNumber: created.projectNumber,
            name: created.name,
            status: created.status,
          },
        },
      });

      return this.serializeDetail(created);
    });
  }

  async update(id: string, dto: UpdateProjectDto, actorId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    if (dto.customerId) {
      await this.assertCustomerExists(dto.customerId);
    }
    if (dto.projectManagerId !== undefined) {
      await this.assertManagerExists(dto.projectManagerId);
    }
    if (dto.projectNumber && dto.projectNumber !== existing.projectNumber) {
      const clash = await this.prisma.project.findFirst({
        where: {
          projectNumber: dto.projectNumber,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (clash) {
        throw new ConflictException('Project number already exists');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          projectNumber: dto.projectNumber,
          name: dto.name,
          description: dto.description,
          customerId: dto.customerId,
          customerContact: dto.customerContact,
          projectManagerId: dto.projectManagerId,
          siteStreet: dto.siteStreet,
          sitePostalCode: dto.sitePostalCode,
          siteCity: dto.siteCity,
          siteCountry: dto.siteCountry,
          startDate:
            dto.startDate === undefined
              ? undefined
              : dto.startDate
                ? new Date(dto.startDate)
                : null,
          expectedCompletionDate:
            dto.expectedCompletionDate === undefined
              ? undefined
              : dto.expectedCompletionDate
                ? new Date(dto.expectedCompletionDate)
                : null,
          actualCompletionDate:
            dto.actualCompletionDate === undefined
              ? undefined
              : dto.actualCompletionDate
                ? new Date(dto.actualCompletionDate)
                : null,
          status: dto.status,
          contractValue: dto.contractValue,
          initialBudget: dto.initialBudget,
          currentBudget: dto.currentBudget,
          currency: dto.currency,
          progressPercent: dto.progressPercent,
          notes: dto.notes,
        },
        include: projectDetailInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PROJECT_UPDATED',
          entityType: 'Project',
          entityId: id,
          previousValue: {
            projectNumber: existing.projectNumber,
            name: existing.name,
            status: existing.status,
            contractValue: existing.contractValue.toString(),
            currentBudget: existing.currentBudget.toString(),
          },
          newValue: {
            projectNumber: updated.projectNumber,
            name: updated.name,
            status: updated.status,
            contractValue: updated.contractValue.toString(),
            currentBudget: updated.currentBudget.toString(),
          },
        },
      });

      return this.serializeDetail(updated);
    });
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PROJECT_DELETED',
          entityType: 'Project',
          entityId: id,
          previousValue: {
            projectNumber: existing.projectNumber,
            name: existing.name,
          },
        },
      });
    });

    return { success: true };
  }
}
