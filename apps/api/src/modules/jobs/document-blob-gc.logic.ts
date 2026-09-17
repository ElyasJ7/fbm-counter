/**
 * Delayed GC for soft-deleted document blobs (pure logic, no Nest imports).
 */

export type DocumentBlobGcPrisma = {
  document: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: { id: true; storageKey: true };
      take: number;
    }) => Promise<Array<{ id: string; storageKey: string | null }>>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    update: (args: {
      where: { id: string };
      data: { storageKey: null; purgedAt: Date };
    }) => Promise<unknown>;
  };
};

export type DocumentBlobGcStorage = {
  deleteFile: (key: string) => Promise<void>;
};

export type DocumentBlobGcLogger = {
  warn: (message: string) => void;
  error: (message: string) => void;
  log: (message: string) => void;
};

export async function purgeExpiredDocumentBlobs(opts: {
  prisma: DocumentBlobGcPrisma;
  storage: DocumentBlobGcStorage;
  retentionDays: number;
  now?: Date;
  logger?: DocumentBlobGcLogger;
  batchSize?: number;
}): Promise<{ purged: number }> {
  const now = opts.now ?? new Date();
  const retentionDays =
    Number.isFinite(opts.retentionDays) && opts.retentionDays >= 0
      ? opts.retentionDays
      : 30;
  const logger = opts.logger;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const candidates = await opts.prisma.document.findMany({
    where: {
      deletedAt: { not: null, lte: cutoff },
      purgedAt: null,
      storageKey: { not: null },
    },
    select: { id: true, storageKey: true },
    take: opts.batchSize ?? 100,
  });

  let purged = 0;
  for (const doc of candidates) {
    if (!doc.storageKey) continue;
    const refs = await opts.prisma.document.count({
      where: {
        storageKey: doc.storageKey,
        id: { not: doc.id },
        purgedAt: null,
      },
    });
    if (refs > 0) {
      logger?.warn(`Skip purge for ${doc.id}: storageKey still referenced`);
      continue;
    }

    try {
      await opts.storage.deleteFile(doc.storageKey);
    } catch (error) {
      logger?.error(
        `Blob delete failed for document ${doc.id}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      continue;
    }

    await opts.prisma.document.update({
      where: { id: doc.id },
      data: {
        storageKey: null,
        purgedAt: now,
      },
    });
    purged += 1;
  }

  logger?.log(
    JSON.stringify({
      msg: 'document_blob_gc',
      candidates: candidates.length,
      purged,
      retentionDays,
      cutoff: cutoff.toISOString(),
    }),
  );
  return { purged };
}
