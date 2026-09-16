import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
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
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: { _count: { select: { projects: true } } },
        orderBy: { companyName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { projects: true } } },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  create(dto: CreateCustomerDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          email: dto.email,
          phone: dto.phone,
          street: dto.street,
          postalCode: dto.postalCode,
          city: dto.city,
          country: dto.country ?? 'DE',
          vatId: dto.vatId,
          taxNumber: dto.taxNumber,
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CUSTOMER_CREATED',
          entityType: 'Customer',
          entityId: customer.id,
          newValue: customer as unknown as Prisma.InputJsonValue,
        },
      });

      return customer;
    });
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    const existing = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data: {
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          email: dto.email,
          phone: dto.phone,
          street: dto.street,
          postalCode: dto.postalCode,
          city: dto.city,
          country: dto.country,
          vatId: dto.vatId,
          taxNumber: dto.taxNumber,
          notes: dto.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CUSTOMER_UPDATED',
          entityType: 'Customer',
          entityId: id,
          previousValue: existing as unknown as Prisma.InputJsonValue,
          newValue: customer as unknown as Prisma.InputJsonValue,
        },
      });

      return customer;
    });
  }

  async remove(id: string, actorId: string) {
    const existing = await this.findOne(id);
    const activeProjects = await this.prisma.project.count({
      where: {
        customerId: id,
        deletedAt: null,
        status: { in: ['PLANNING', 'ACTIVE', 'ON_HOLD'] },
      },
    });
    if (activeProjects > 0) {
      throw new BadRequestException(
        'Cannot delete customer with active or planning projects',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CUSTOMER_DELETED',
          entityType: 'Customer',
          entityId: id,
          previousValue: existing as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return { success: true };
  }
}
