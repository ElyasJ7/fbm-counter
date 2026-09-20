import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus, Role } from '@prisma/client';
import { money, resolveInvoiceStatus } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Daily overdue sweep.
 *
 * Multi-instance note: uses PostgreSQL advisory lock `pg_try_advisory_lock`
 * so only one API replica runs the job at a time. If the lock cannot be taken,
 * the run is skipped safely.
 *
 * Lifecycle:
 * 1. Find open invoices past due with remaining balance
 * 2. Set status OVERDUE when derived
 * 3. Notify with dedupeKey invoice.overdue:<id>
 * 4. When an invoice leaves OVERDUE, callers should clear dedupe via
 *    NotificationsService.clearInvoiceOverdueDedupe
 */
@Injectable()
export class OverdueInvoicesJob {
  private readonly logger = new Logger(OverdueInvoicesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyOverdueSweep() {
    await this.runSweep('cron');
  }

  /** Exposed for tests / manual ops triggers. */
  async runSweep(source = 'manual') {
    const locked = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(872314059) AS locked
    `;
    if (!locked[0]?.locked) {
      this.logger.log(`Overdue sweep skipped (${source}): advisory lock held`);
      return { skipped: true, updated: 0, notified: 0 };
    }

    try {
      const asOf = new Date();
      const candidates = await this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.OPEN,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.OVERDUE,
            ],
          },
          dueDate: { lt: asOf },
        },
        include: {
          project: { select: { projectNumber: true, name: true } },
        },
        take: 5000,
      });

      let updated = 0;
      let notified = 0;

      for (const invoice of candidates) {
        const remaining = money(invoice.grossAmount).minus(invoice.paidAmount);
        if (remaining.lessThanOrEqualTo(0)) {
          if (invoice.status === InvoiceStatus.OVERDUE) {
            await this.notifications.clearInvoiceOverdueDedupe(invoice.id);
          }
          continue;
        }

        const nextStatus = resolveInvoiceStatus({
          currentStatus: invoice.status,
          grossAmount: invoice.grossAmount.toString(),
          paidAmount: invoice.paidAmount.toString(),
          dueDate: invoice.dueDate,
          asOf,
        });

        if (nextStatus !== InvoiceStatus.OVERDUE) {
          continue;
        }

        const previousStatus = invoice.status;
        if (previousStatus !== InvoiceStatus.OVERDUE) {
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: InvoiceStatus.OVERDUE },
          });
          updated += 1;

          await this.prisma.auditLog.create({
            data: {
              action: 'INVOICE_MARKED_OVERDUE',
              entityType: 'Invoice',
              entityId: invoice.id,
              previousValue: { status: previousStatus },
              newValue: { status: InvoiceStatus.OVERDUE, source },
            },
          });
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

        const pm = await this.notifications.notifyProjectManager(
          invoice.projectId,
          payload,
        );
        const acc = await this.notifications.createForRoles(
          [Role.ACCOUNTING, Role.MANAGEMENT],
          payload,
        );
        notified += (pm.created ?? 0) + (acc.created ?? 0);
      }

      this.logger.log(
        `Overdue sweep (${source}): updated=${updated} notified=${notified} scanned=${candidates.length}`,
      );
      return { skipped: false, updated, notified };
    } finally {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(872314059)
      `;
    }
  }
}
