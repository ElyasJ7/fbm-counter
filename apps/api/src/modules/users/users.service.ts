import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    status: UserStatus;
    preferredDisplayCurrency?: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      preferredDisplayCurrency: user.preferredDisplayCurrency ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        preferredDisplayCurrency: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return users.map((user) => this.serialize(user));
  }

  findProjectManagers() {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        role: { in: ['ADMIN', 'MANAGEMENT', 'PROJECT_MANAGER'] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(dto: CreateUserDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);
    const status = dto.status ?? UserStatus.INVITED;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          role: dto.role,
          status,
          passwordHash,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: user.id,
          newValue: {
            email: user.email,
            role: user.role,
            status: user.status,
          },
        },
      });

      return this.serialize(user);
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (existing.id === actorId && dto.status === UserStatus.INACTIVE) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (
      existing.id === actorId &&
      dto.role &&
      dto.role !== existing.role &&
      existing.role === Role.ADMIN
    ) {
      throw new BadRequestException('You cannot change your own admin role');
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const clash = await this.prisma.user.findFirst({
        where: { email, deletedAt: null, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException('Email already in use');
      }
    }

    const passwordHash = dto.password
      ? await argon2.hash(dto.password)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          email: dto.email?.trim().toLowerCase(),
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          role: dto.role,
          status: dto.status,
          passwordHash,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          previousValue: {
            email: existing.email,
            role: existing.role,
            status: existing.status,
          },
          newValue: {
            email: user.email,
            role: user.role,
            status: user.status,
            passwordChanged: Boolean(passwordHash),
          },
        },
      });

      return this.serialize(user);
    });
  }

  async deactivate(id: string, actorId: string) {
    if (id === actorId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    return this.update(id, { status: UserStatus.INACTIVE }, actorId);
  }
}
