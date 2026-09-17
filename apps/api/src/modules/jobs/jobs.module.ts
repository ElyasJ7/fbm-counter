import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsModule } from '../documents/documents.module';
import { OverdueInvoicesJob } from './overdue-invoices.job';
import { DocumentBlobGcJob } from './document-blob-gc.job';
import {
  DOCUMENT_BLOB_GC_CONFIG,
  DocumentBlobGcService,
} from './document-blob-gc.service';

@Module({
  imports: [NotificationsModule, DocumentsModule],
  providers: [
    OverdueInvoicesJob,
    {
      provide: DOCUMENT_BLOB_GC_CONFIG,
      useFactory: (config: ConfigService) => ({
        getRetentionDays: () => {
          const raw = Number(
            config.get<string>('DOCUMENT_BLOB_RETENTION_DAYS') ?? '30',
          );
          return Number.isFinite(raw) && raw >= 0 ? raw : 30;
        },
      }),
      inject: [ConfigService],
    },
    DocumentBlobGcService,
    DocumentBlobGcJob,
  ],
  exports: [OverdueInvoicesJob, DocumentBlobGcService],
})
export class JobsModule {}
