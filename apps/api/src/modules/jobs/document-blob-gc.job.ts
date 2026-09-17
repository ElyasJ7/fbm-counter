import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentBlobGcService } from './document-blob-gc.service';

@Injectable()
export class DocumentBlobGcJob {
  constructor(private readonly gc: DocumentBlobGcService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron() {
    await this.gc.purgeExpired();
  }
}
