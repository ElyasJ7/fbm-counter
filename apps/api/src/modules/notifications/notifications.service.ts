import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationPayload = {
  title: string;
  message: string;
  type: string;
  link?: string | null;
};

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(row: {
    id: string;
    title: string;
    message: string;
    type: string;
    link: string | null;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type,
      link: row.link,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private client(tx?: Prisma.TransactionClient): DbClient {
    return tx ?? this.prisma;
  }

  async createForUsers(
    userIds: string[],
    payload: NotificationPayload,
    tx?: Prisma.TransactionClient,
  ) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    const db = this.client(tx);
    await db.notification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        link: payload.link ?? null,
      })),
    });
  }

  async createForRoles(
    roles: Role[],
    payload: NotificationPayload,
    options?: { excludeUserId?: string; tx?: Prisma.TransactionClient },
  ) {
    const db = this.client(options?.tx);
    const users = await db.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        role: { in: roles },
        ...(options?.excludeUserId
          ? { id: { not: options.excludeUserId } }
          : {}),
      },
      select: { id: true },
    });
    await this.createForUsers(
      users.map((user) => user.id),
      payload,
      options?.tx,
    );
  }

  async notifyProjectManager(
    projectId: string | null | undefined,
    payload: NotificationPayload,
    options?: { excludeUserId?: string; tx?: Prisma.TransactionClient },
  ) {
    if (!projectId) return;
    const db = this.client(options?.tx);
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { projectManagerId: true },
    });
    if (
      !project?.projectManagerId ||
      project.projectManagerId === options?.excludeUserId
    ) {
      return;
    }
    await this.createForUsers([project.projectManagerId], payload, options?.tx);
  }

  async findAllForUser(
    userId: string,
    params: { page?: number; pageSize?: number; unreadOnly?: boolean },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: data.map((row) => this.serialize(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.readAt) {
      return this.serialize(existing);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.serialize(updated);
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, updated: result.count };
  }
}
