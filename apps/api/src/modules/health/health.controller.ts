import { Controller, Get } from '@nestjs/common';
import { Roles, Public } from '../../common/decorators/auth.decorators';
import { MetricsService } from '../common/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly storage: StorageService,
  ) {}

  /** Liveness — process is up (also checks DB for backward compatibility). */
  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      service: 'fbm-api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness — DB (+ optional storage driver smoke). */
  @Public()
  @Get('ready')
  async ready() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    let storage: 'up' | 'unknown' = 'unknown';
    try {
      // Driver presence check — does not list buckets/files.
      await this.storage.fileExists('__healthcheck_missing__');
      storage = 'up';
    } catch {
      storage = 'unknown';
    }

    const status = database === 'up' ? 'ready' : 'not_ready';
    return {
      status,
      database,
      storage,
      timestamp: new Date().toISOString(),
    };
  }

  /** In-process metrics — admin only. */
  @Get('metrics')
  @Roles('ADMIN')
  metricsSnapshot() {
    return this.metrics.snapshot();
  }
}
