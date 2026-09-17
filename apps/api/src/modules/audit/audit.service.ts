import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditListQuery = {
  page?: number;
  pageSize?: number;
  entityType?: string;
  action?: string;
  actorId?: string;
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(
    log: Prisma.AuditLogGetPayload<{
      include: {
        actor: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            email: true;
          };
        };
      };
    }>,
    detailed = false,
  ) {
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
      actor: log.actor,
      ipAddress: detailed ? log.ipAddress : null,
      userAgent: detailed ? log.userAgent : null,
      previousValue: detailed ? log.previousValue : null,
      newValue: detailed ? log.newValue : null,
    };
  }

  private parseDayBoundary(value: string | undefined, endOfDay: boolean) {
    if (!value?.trim()) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (endOfDay) {
      return new Date(year, month - 1, day, 23, 59, 59, 999);
    }
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  async findAll(params: AuditListQuery) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const search = params.search?.trim();
    const from = this.parseDayBoundary(params.from, false);
    const to = this.parseDayBoundary(params.to, true);

    const where: Prisma.AuditLogWhereInput = {
      ...(params.entityType?.trim()
        ? { entityType: params.entityType.trim() }
        : {}),
      ...(params.action?.trim()
        ? { action: { contains: params.action.trim(), mode: 'insensitive' } }
        : {}),
      ...(params.actorId?.trim() ? { actorId: params.actorId.trim() } : {}),
      ...(params.entityId?.trim() ? { entityId: params.entityId.trim() } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
              { entityId: { contains: search, mode: 'insensitive' } },
              {
                actor: {
                  OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.serialize(row, false)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    if (!log) {
      throw new NotFoundException('Audit log not found');
    }
    return this.serialize(log, true);
  }

  async listEntityTypes() {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    });
    return { data: rows.map((row) => row.entityType) };
  }
}
