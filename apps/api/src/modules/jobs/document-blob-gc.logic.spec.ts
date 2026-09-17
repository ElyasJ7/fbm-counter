import { purgeExpiredDocumentBlobs } from './document-blob-gc.logic';

describe('purgeExpiredDocumentBlobs', () => {
  it('purges expired soft-deleted blobs and is idempotent on empty runs', async () => {
    const deleted = { id: 'd1', storageKey: 'files/a.pdf' };
    const prisma = {
      document: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([deleted])
          .mockResolvedValueOnce([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const storage = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const first = await purgeExpiredDocumentBlobs({
      prisma,
      storage,
      retentionDays: 0,
      now: new Date('2026-09-17T12:00:00.000Z'),
    });
    expect(first.purged).toBe(1);
    expect(storage.deleteFile).toHaveBeenCalledWith('files/a.pdf');
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: {
        storageKey: null,
        purgedAt: new Date('2026-09-17T12:00:00.000Z'),
      },
    });

    const second = await purgeExpiredDocumentBlobs({
      prisma,
      storage,
      retentionDays: 0,
      now: new Date('2026-09-17T12:00:00.000Z'),
    });
    expect(second.purged).toBe(0);
  });

  it('skips blobs still referenced by another document', async () => {
    const prisma = {
      document: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'd1', storageKey: 'shared.pdf' }]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
    };
    const storage = { deleteFile: jest.fn() };
    const result = await purgeExpiredDocumentBlobs({
      prisma,
      storage,
      retentionDays: 0,
    });
    expect(result.purged).toBe(0);
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('leaves metadata when storage delete fails', async () => {
    const prisma = {
      document: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'd1', storageKey: 'files/a.pdf' }]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
    };
    const storage = {
      deleteFile: jest.fn().mockRejectedValue(new Error('S3 unavailable')),
    };
    const result = await purgeExpiredDocumentBlobs({
      prisma,
      storage,
      retentionDays: 0,
    });
    expect(result.purged).toBe(0);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('does not purge unrelated active documents', async () => {
    const prisma = {
      document: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    const storage = { deleteFile: jest.fn() };
    await purgeExpiredDocumentBlobs({
      prisma,
      storage,
      retentionDays: 30,
    });
    expect(prisma.document.findMany).toHaveBeenCalledTimes(1);
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});
