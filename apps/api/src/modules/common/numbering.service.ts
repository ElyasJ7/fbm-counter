import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * Concurrency-safe business numbering via atomic PostgreSQL upsert.
 * Keys look like `invoice:RE-2026` or `payment:PAY-202609`.
 */
@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async allocateNext(key: string, tx: Tx = this.prisma): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ next_value: number }>>`
      INSERT INTO number_sequences (key, "nextValue", "updatedAt")
      VALUES (${key}, 2, NOW())
      ON CONFLICT (key) DO UPDATE
        SET "nextValue" = number_sequences."nextValue" + 1,
            "updatedAt" = NOW()
      RETURNING ("nextValue" - 1) AS next_value
    `;
    const value = rows[0]?.next_value;
    if (!value || value < 1) {
      throw new Error(`Failed to allocate number sequence for ${key}`);
    }
    return value;
  }

  /** Seed sequence from existing max so upgrades don't restart at 1. */
  async ensureAtLeast(
    key: string,
    minimumNext: number,
    tx: Tx = this.prisma,
  ): Promise<void> {
    if (minimumNext < 1) return;
    await tx.$executeRaw`
      INSERT INTO number_sequences (key, "nextValue", "updatedAt")
      VALUES (${key}, ${minimumNext}, NOW())
      ON CONFLICT (key) DO UPDATE
        SET "nextValue" = GREATEST(number_sequences."nextValue", EXCLUDED."nextValue"),
            "updatedAt" = NOW()
    `;
  }
}
