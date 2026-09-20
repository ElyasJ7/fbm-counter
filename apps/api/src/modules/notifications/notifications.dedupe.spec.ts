import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService overdue dedupe', () => {
  let notifications: NotificationsService;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://fbm:fbm_dev_password@localhost:5432/fbm_counter?schema=public';

    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsService, PrismaService],
    }).compile();

    notifications = moduleRef.get(NotificationsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: {
        email: `notify-dedupe-${Date.now()}@example.com`,
        passwordHash: 'x',
        firstName: 'N',
        lastName: 'D',
        role: 'ACCOUNTING',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it('does not create duplicate unread overdue notifications', async () => {
    const payload = {
      title: 'Invoice overdue',
      message: 'TEST-INV overdue',
      type: 'invoice.overdue',
      link: '/invoices',
      dedupeKey: `invoice.overdue:test-${Date.now()}`,
    };

    const first = await notifications.createForUsers([userId], payload);
    const second = await notifications.createForUsers([userId], payload);
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);

    const count = await prisma.notification.count({
      where: { userId, dedupeKey: payload.dedupeKey, readAt: null },
    });
    expect(count).toBe(1);
  });
});
