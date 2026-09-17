import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import type { Readable } from 'stream';
import type { StorageConfig } from './local-object-storage';
import {
  buildStorageKey,
  type ObjectStorageDriver,
  type StoredUpload,
} from './object-storage';

export class S3ObjectStorage implements ObjectStorageDriver {
  readonly driverName = 's3' as const;
  private readonly logger = new Logger(S3ObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(private readonly config: StorageConfig) {
    const bucket = this.config.get<string>('S3_BUCKET')?.trim();
    if (!bucket) {
      throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
    }
    this.bucket = bucket;
    this.prefix = (this.config.get<string>('S3_PREFIX') ?? 'documents').replace(
      /^\/+|\/+$/g,
      '',
    );

    const region = this.config.get<string>('S3_REGION') ?? 'eu-central-1';
    const endpoint = this.config.get<string>('S3_ENDPOINT')?.trim();
    const forcePathStyle =
      this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true';

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle } : {}),
      credentials: this.resolveCredentials(),
    });
  }

  private resolveCredentials() {
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config
      .get<string>('S3_SECRET_ACCESS_KEY')
      ?.trim();
    if (accessKeyId && secretAccessKey) {
      return { accessKeyId, secretAccessKey };
    }
    return undefined;
  }

  private objectKey(storageKey: string) {
    const cleaned = storageKey.replace(/^\/+/, '');
    if (
      cleaned.includes('..') ||
      cleaned.startsWith('/') ||
      cleaned.includes('\\')
    ) {
      throw new Error('Invalid storage key');
    }
    return this.prefix ? `${this.prefix}/${cleaned}` : cleaned;
  }

  ensureReady(): Promise<void> {
    this.logger.log(
      `S3 document storage ready (bucket=${this.bucket}, prefix=${this.prefix || '(none)'})`,
    );
    return Promise.resolve();
  }

  getMaxUploadBytes(): number {
    const raw = this.config.get<string>('MAX_UPLOAD_BYTES');
    const parsed = raw ? Number(raw) : 10_485_760;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_485_760;
  }

  async saveUpload(file: Express.Multer.File): Promise<StoredUpload> {
    const storageKey = buildStorageKey(file.originalname);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      }),
    );
    return { storageKey };
  }

  async openReadStream(storageKey: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
      }),
    );
    if (!response.Body) {
      throw new Error('Empty S3 object body');
    }
    return response.Body as Readable;
  }

  async fileExists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(storageKey),
        }),
      );
      return true;
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'NotFound' || name === 'NoSuchKey') return false;
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (status === 404) return false;
      throw error;
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
      }),
    );
  }
}
