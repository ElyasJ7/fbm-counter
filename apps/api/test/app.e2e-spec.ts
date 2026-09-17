import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { MetricsService } from '../src/modules/common/metrics.service';
import { StorageService } from '../src/modules/documents/storage.service';
import { HealthController } from '../src/modules/health/health.controller';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            snapshot: () => ({ requestsTotal: 0 }),
          },
        },
        {
          provide: StorageService,
          useValue: {
            fileExists: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('fbm-api');
      });
  });
});
