import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertSupportedCurrency,
  DEFAULT_CURRENCY,
  type SupportedCurrency,
} from '@fbm/shared';

type CurrencyDb = Pick<Prisma.TransactionClient, 'project' | 'companySettings'>;

/**
 * Resolve transaction currency for invoices/expenses:
 * explicit DTO → project currency → company books → EUR.
 */
export async function resolveTransactionCurrency(
  db: CurrencyDb,
  input: {
    explicit?: string | null;
    projectId?: string | null;
  },
): Promise<SupportedCurrency> {
  if (input.explicit != null && String(input.explicit).trim() !== '') {
    try {
      return assertSupportedCurrency(String(input.explicit));
    } catch {
      throw new BadRequestException(
        `Unsupported currency "${input.explicit}". Allowed: AFN, EUR, USD`,
      );
    }
  }

  if (input.projectId) {
    const project = await db.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { currency: true },
    });
    if (project?.currency) {
      try {
        return assertSupportedCurrency(project.currency);
      } catch {
        /* fall through */
      }
    }
  }

  const settings = await db.companySettings.findFirst({
    select: { defaultCurrency: true },
  });
  try {
    return assertSupportedCurrency(
      settings?.defaultCurrency ?? DEFAULT_CURRENCY,
    );
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function parseSupportedCurrencyOrThrow(
  value: string,
): SupportedCurrency {
  try {
    return assertSupportedCurrency(value);
  } catch {
    throw new BadRequestException(
      `Unsupported currency "${value}". Allowed: AFN, EUR, USD`,
    );
  }
}
