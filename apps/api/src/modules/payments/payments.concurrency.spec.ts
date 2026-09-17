import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { money } from '@fbm/financial-core';
import { BudgetsService } from '../budgets/budgets.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

/**
 * Integration stress test — requires local Postgres (docker compose).
 * Two concurrent €600 payments on a €600 invoice must not overpay.
 */
describe('PaymentsService concurrent overpayment guard', () => {
  let payments: PaymentsService;
  let prisma: PrismaService;
  let invoiceId: string;
  let customerId: string;
  let actorId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://fbm:fbm_dev_password@localhost:5432/fbm_counter?schema=public';

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        PrismaService,
        {
          provide: BudgetsService,
          useValue: {
            syncAndNotifyOverruns: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    payments = moduleRef.get(PaymentsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const stamp = Date.now();
    const actor = await prisma.user.create({
      data: {
        email: `pay-actor-${stamp}@example.com`,
        passwordHash: 'test-hash-not-used',
        firstName: 'Pay',
        lastName: 'Actor',
        role: 'ACCOUNTING',
      },
    });
    actorId = actor.id;

    const customer = await prisma.customer.create({
      data: {
        companyName: `Concurrent Pay Co ${stamp}`,
        email: `concurrent-${stamp}@example.com`,
      },
    });
    customerId = customer.id;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-CONC-${stamp}`,
        type: InvoiceType.CUSTOMER,
        customerId,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 86400000),
        netAmount: '504.2017',
        taxRate: '19',
        taxAmount: '95.7983',
        grossAmount: '600.0000',
        paidAmount: '0',
        status: InvoiceStatus.OPEN,
      },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    if (invoiceId) {
      const paymentIds = (
        await prisma.payment.findMany({
          where: { invoiceId },
          select: { id: true },
        })
      ).map((p) => p.id);
      if (paymentIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { entityType: 'Payment', entityId: { in: paymentIds } },
        });
      }
      await prisma.payment.deleteMany({ where: { invoiceId } });
      await prisma.invoice.deleteMany({ where: { id: invoiceId } });
    }
    if (customerId) {
      await prisma.customer.deleteMany({ where: { id: customerId } });
    }
    if (actorId) {
      await prisma.auditLog.deleteMany({ where: { actorId } });
      await prisma.user.deleteMany({ where: { id: actorId } });
    }
    await prisma.$disconnect();
  });

  it('allows only one of two concurrent full payments', async () => {
    const payload = {
      invoiceId,
      paymentDate: new Date().toISOString(),
      amount: '600.0000',
    };

    const results = await Promise.allSettled([
      payments.create(payload, actorId),
      payments.create(payload, actorId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    if (fulfilled.length === 0) {
      const messages = rejected.map((r) =>
        r.status === 'rejected'
          ? r.reason instanceof Error
            ? r.reason.message
            : String(r.reason)
          : '',
      );
      throw new Error(`Both payments failed: ${messages.join(' | ')}`);
    }

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const rejection = rejected[0];
    expect(rejection.reason).toBeInstanceOf(BadRequestException);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    const paymentAgg = await prisma.payment.aggregate({
      where: { invoiceId, deletedAt: null },
      _sum: { amount: true },
    });
    const paidFromPayments = paymentAgg._sum.amount
      ? paymentAgg._sum.amount.toDecimalPlaces(4).toFixed(4)
      : '0.0000';

    expect(invoice.paidAmount.toFixed(4)).toBe('600.0000');
    expect(paidFromPayments).toBe('600.0000');
    expect(money(paidFromPayments).lessThanOrEqualTo(600)).toBe(true);
    expect(invoice.status).toBe(InvoiceStatus.PAID);
  });
});
