import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Real API e2e against Postgres. Uses isolated CI credentials from env.
 * Seed must have been applied (ALLOW_SEED=true).
 */
describe('Auth & permissions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const agent = () => request.agent(app.getHttpServer());

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://fbm:fbm_dev_password@localhost:5432/fbm_counter?schema=public';
    process.env.JWT_ACCESS_SECRET ??=
      'ci-access-secret-min-32-characters-long!!';
    process.env.JWT_REFRESH_SECRET ??=
      'ci-refresh-secret-min-32-characters-long!';
    process.env.COOKIE_SECURE = 'false';
    process.env.COOKIE_SAME_SITE = 'lax';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated /auth/me with 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('logs in admin and returns /auth/me', async () => {
    const client = agent();
    await client
      .post('/api/auth/login')
      .send({
        email: 'admin@musterbau.example',
        password: 'Admin123!',
      })
      .expect(201);

    const me = await client.get('/api/auth/me').expect(200);
    expect(me.body.email).toBe('admin@musterbau.example');
    expect(me.body.role).toBe('ADMIN');
  });

  it('denies VIEWER invoice create with 403', async () => {
    const client = agent();
    await client
      .post('/api/auth/login')
      .send({
        email: 'viewer@musterbau.example',
        password: 'Viewer123!',
      })
      .expect(201);

    await client
      .post('/api/invoices')
      .send({
        type: 'CUSTOMER',
        issueDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        netAmount: '100',
        customerId: 'does-not-matter',
      })
      .expect(403);
  });

  it('denies PROJECT_MANAGER expense approve with 403', async () => {
    const pm = await prisma.user.findFirst({
      where: { role: 'PROJECT_MANAGER', deletedAt: null },
    });
    expect(pm).toBeTruthy();

    const created = await prisma.expense.create({
      data: {
        expenseNumber: `EXP-E2E-${Date.now()}`,
        description: 'e2e approve denial',
        netAmount: '10',
        taxRate: '19',
        taxAmount: '1.9',
        grossAmount: '11.9',
        paidAmount: '0',
        status: 'PENDING',
      },
    });

    try {
      const client = agent();
      await client
        .post('/api/auth/login')
        .send({
          email: pm!.email,
          password: 'Project123!',
        })
        .expect(201);
      await client.patch(`/api/expenses/${created.id}/approve`).expect(403);
    } finally {
      await prisma.expense.delete({ where: { id: created.id } });
    }
  });

  it('financial happy-path: accounting can list dashboard KPIs', async () => {
    const client = agent();
    await client
      .post('/api/auth/login')
      .send({
        email: 'accounting@musterbau.example',
        password: 'Accounting123!',
      })
      .expect(201);

    const dash = await client.get('/api/dashboard').expect(200);
    expect(dash.body.kpis).toEqual(
      expect.objectContaining({
        totalRevenue: expect.any(String),
        totalExpenses: expect.any(String),
        outstandingCustomerInvoices: expect.any(String),
        outstandingSupplierInvoices: expect.any(String),
      }),
    );
  });
});
