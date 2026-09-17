import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalObjectStorage } from './local-object-storage';
import { buildStorageKey, safeExtension } from './object-storage';

function mockConfig(values: Record<string, string | undefined>) {
  return {
    get: <T = string>(key: string) => values[key] as T | undefined,
  };
}

describe('object storage helpers', () => {
  it('sanitizes file extensions', () => {
    expect(safeExtension('invoice.PDF')).toBe('.pdf');
    expect(safeExtension('archive.tar.gz')).toBe('.gz');
    expect(safeExtension('noext')).toBe('');
    expect(safeExtension('evil.exe.shhhhhhhhhhhhh')).toBe('');
  });

  it('builds dated storage keys', () => {
    const key = buildStorageKey('quote.pdf');
    expect(key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/i);
  });

  it('creates distinct keys', () => {
    const a = buildStorageKey('a.pdf');
    const b = buildStorageKey('a.pdf');
    expect(a).not.toBe(b);
  });
});

describe('LocalObjectStorage', () => {
  let dir: string;
  let storage: LocalObjectStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fbm-storage-'));
    storage = new LocalObjectStorage(
      mockConfig({
        UPLOAD_DIR: dir,
        MAX_UPLOAD_BYTES: '1048576',
      }),
    );
    await storage.ensureReady();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects path traversal in storage keys', () => {
    expect(() => storage.resolveKey('../secret.txt')).toThrow(
      'Invalid storage key',
    );
  });

  it('saves and reads uploads', async () => {
    const file = {
      originalname: 'note.txt',
      buffer: Buffer.from('hello'),
      mimetype: 'text/plain',
      size: 5,
    } as Express.Multer.File;

    const saved = await storage.saveUpload(file);
    expect(await storage.fileExists(saved.storageKey)).toBe(true);

    const stream = await storage.openReadStream(saved.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello');

    await storage.deleteFile(saved.storageKey);
    expect(await storage.fileExists(saved.storageKey)).toBe(false);
  });

  it('reports max upload bytes from config', () => {
    expect(storage.getMaxUploadBytes()).toBe(1_048_576);
  });
});
