import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../documents/storage.service';
import { purgeExpiredDocumentBlobs } from './document-blob-gc.logic';

export const DOCUMENT_BLOB_GC_CONFIG = Symbol('DOCUMENT_BLOB_GC_CONFIG');

export type DocumentBlobGcConfig = {
  getRetentionDays: () => number;
};

/**
 * Delayed garbage collection for soft-deleted document blobs.
 * Retention: DOCUMENT_BLOB_RETENTION_DAYS (default 30).
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
      this.running = false;
    }
  }
}
