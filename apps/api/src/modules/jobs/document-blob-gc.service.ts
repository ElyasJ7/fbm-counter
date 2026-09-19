import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { purgeExpiredDocumentBlobs } from './document-blob-gc.logic';

export const DOCUMENT_BLOB_GC_CONFIG = Symbol('DOCUMENT_BLOB_GC_CONFIG');

export type DocumentBlobGcConfig = {
  getRetentionDays: () => number;
};

/** Advisory lock key distinct from overdue job (872314059). */
const BLOB_GC_LOCK_KEY = 872314060;

/**
 * Delayed garbage collection for soft-deleted document blobs.
 * Retention: DOCUMENT_BLOB_RETENTION_DAYS (default 30).
 * Multi-instance safe via PostgreSQL advisory lock.
 */
@Injectable()
export class DocumentBlobGcService {
  private readonly logger = new Logger(DocumentBlobGcService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(DOCUMENT_BLOB_GC_CONFIG)
    private readonly config: DocumentBlobGcConfig,
  ) {}

  async purgeExpired(now = new Date()) {
    if (this.running) {
      this.logger.warn('Document blob GC already running — skip');
      return { purged: 0, skipped: true };
    }
    this.running = true;

    const locked = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${BLOB_GC_LOCK_KEY}) AS locked
    `;
    if (!locked[0]?.locked) {
      this.running = false;
      this.logger.log('Document blob GC skipped: advisory lock held');
      return { purged: 0, skipped: true };
    }

    try {
      const result = await purgeExpiredDocumentBlobs({
        prisma: this.prisma,
        storage: this.storage,
        retentionDays: this.config.getRetentionDays(),
        now,
        logger: this.logger,
      });
      return { ...result, skipped: false };
    } finally {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(${BLOB_GC_LOCK_KEY})
      `;
      this.running = false;
    }
  }
}
