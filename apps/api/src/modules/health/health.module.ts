import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DocumentsModule],
  controllers: [HealthController],
})
export class HealthModule {}
