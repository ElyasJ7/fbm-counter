import { randomUUID } from 'crypto';
import type { Readable } from 'stream';

export type StoredUpload = {
  storageKey: string;
};

export interface ObjectStorageDriver {
  readonly driverName: 'local' | 's3';
  ensureReady(): Promise<void>;
  getMaxUploadBytes(): number;
  saveUpload(file: Express.Multer.File): Promise<StoredUpload>;
  openReadStream(storageKey: string): Promise<Readable>;
  fileExists(storageKey: string): Promise<boolean>;
  deleteFile(storageKey: string): Promise<void>;
}

export function safeExtension(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot < 0) return '';
  const ext = originalName.slice(lastDot).toLowerCase();
  if (!ext || ext.length > 12 || !/^\.[a-z0-9.]+$/i.test(ext)) {
    return '';
  }
  return ext;
}

export function buildStorageKey(originalName: string): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${randomUUID()}${safeExtension(originalName)}`;
}
