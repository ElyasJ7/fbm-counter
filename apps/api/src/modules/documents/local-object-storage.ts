import { createReadStream, existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { Readable } from 'stream';
import {
  buildStorageKey,
  type ObjectStorageDriver,
  type StoredUpload,
} from './object-storage';

/** Minimal config surface so drivers stay Jest-friendly (no ESM Nest imports). */
export type StorageConfig = {
  get<T = string>(key: string): T | undefined;
};

export class LocalObjectStorage implements ObjectStorageDriver {
  readonly driverName = 'local' as const;
  private readonly uploadDir: string;

  constructor(private readonly config: StorageConfig) {
    const configured = this.config.get<string>('UPLOAD_DIR') ?? 'uploads';
    this.uploadDir = resolve(configured);
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true });
  }

  getMaxUploadBytes(): number {
    const raw = this.config.get<string>('MAX_UPLOAD_BYTES');
    const parsed = raw ? Number(raw) : 10_485_760;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_485_760;
  }

  async saveUpload(file: Express.Multer.File): Promise<StoredUpload> {
    const storageKey = buildStorageKey(file.originalname);
    const absolutePath = this.resolveKey(storageKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);
    return { storageKey };
  }

  async openReadStream(storageKey: string): Promise<Readable> {
    return createReadStream(this.resolveKey(storageKey));
  }

  async fileExists(storageKey: string): Promise<boolean> {
    return existsSync(this.resolveKey(storageKey));
  }

  async deleteFile(storageKey: string): Promise<void> {
    const absolutePath = this.resolveKey(storageKey);
    if (!existsSync(absolutePath)) return;
    await unlink(absolutePath);
  }

  /** Exported for unit tests — rejects path traversal. */
  resolveKey(storageKey: string): string {
    const absolutePath = resolve(this.uploadDir, storageKey);
    if (
      absolutePath !== this.uploadDir &&
      !absolutePath.startsWith(this.uploadDir + '\\') &&
      !absolutePath.startsWith(this.uploadDir + '/')
    ) {
      throw new Error('Invalid storage key');
    }
    return absolutePath;
  }
}
