import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';
import { LocalObjectStorage } from './local-object-storage';
import type { ObjectStorageDriver, StoredUpload } from './object-storage';
import { S3ObjectStorage } from './s3-object-storage';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: ObjectStorageDriver;

  constructor(config: ConfigService) {
    const mode = (
      config.get<string>('STORAGE_DRIVER') ?? 'local'
    ).toLowerCase();

    if (mode === 's3') {
      this.driver = new S3ObjectStorage(config);
    } else {
      this.driver = new LocalObjectStorage(config);
    }
  }

  async onModuleInit() {
    await this.driver.ensureReady();
    this.logger.log(`Document storage driver: ${this.driver.driverName}`);
  }

  getMaxUploadBytes(): number {
    return this.driver.getMaxUploadBytes();
  }

  saveUpload(file: Express.Multer.File): Promise<StoredUpload> {
    return this.driver.saveUpload(file);
  }

  openReadStream(storageKey: string): Promise<Readable> {
    return this.driver.openReadStream(storageKey);
  }

  fileExists(storageKey: string): Promise<boolean> {
    return this.driver.fileExists(storageKey);
  }

  deleteFile(storageKey: string): Promise<void> {
    return this.driver.deleteFile(storageKey);
  }
}
