import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationPayload = {
  title: string;
  message: string;
  type: string;
  link?: string | null;
  /**
   * Idempotency key. Unique per user while the row exists.
   * Example: `invoice.overdue:<invoiceId>`
   * Clear/read notifications and omit/change key to allow a later re-fire
   * after the invoice becomes current and overdue again.
   */
  dedupeKey?: string | null;
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
    if (uniqueIds.length === 0) return { created: 0 };

    const db = this.client(tx);
    const dedupeKey = payload.dedupeKey?.trim() || null;

    if (!dedupeKey) {
      await db.notification.createMany({
        data: uniqueIds.map((userId) => ({
          userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          link: payload.link ?? null,
        })),
      });
      return { created: uniqueIds.length };
    }

    let created = 0;
    for (const userId of uniqueIds) {
      const existing = await db.notification.findFirst({
        where: { userId, dedupeKey },
        select: { id: true, readAt: true },
      });
      // Skip while an unread (or any) notification with this key exists.
      // After the invoice is cured we mark these read and delete the key
      // via clearDedupeKey so a later overdue cycle can notify again.
      if (existing && !existing.readAt) {
        continue;
      }
      if (existing && existing.readAt) {
        // Re-open cycle: remove old key row so unique constraint allows insert
        await db.notification.update({
          where: { id: existing.id },
          data: { dedupeKey: null },
        });
      }
      try {
        await db.notification.create({
          data: {
            userId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            link: payload.link ?? null,
            dedupeKey,
          },
        });
        created += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    return { created };
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
    return this.createForUsers(
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
    if (!projectId) return { created: 0 };
    const db = this.client(options?.tx);
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { projectManagerId: true },
    });
    if (
      !project?.projectManagerId ||
      project.projectManagerId === options?.excludeUserId
    ) {
      return { created: 0 };
    }
    return this.createForUsers(
      [project.projectManagerId],
      payload,
      options?.tx,
    );
  }

  /** Mark overdue notifications read and clear dedupe keys for an invoice. */
  async clearInvoiceOverdueDedupe(
    invoiceId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = this.client(tx);
    const key = `invoice.overdue:${invoiceId}`;
    await db.notification.updateMany({
      where: { dedupeKey: key, readAt: null },
      data: { readAt: new Date(), dedupeKey: null },
    });
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
