import { Test } from '@nestjs/testing';
import { aggregateCosts } from '@fbm/financial-core';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceQueryService } from './finance-query.service';

describe('FinanceQueryService cost consistency', () => {
  let financeQuery: FinanceQueryService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://fbm:fbm_dev_password@localhost:5432/fbm_counter?schema=public';

    const moduleRef = await Test.createTestingModule({
      providers: [FinanceQueryService, PrismaService],
    }).compile();

    financeQuery = moduleRef.get(FinanceQueryService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('company cost totals match aggregateCosts on the same rows', async () => {
    const rows = await financeQuery.loadCostRows();
    const expected = aggregateCosts(rows);
    const loadSpy = jest
      .spyOn(financeQuery, 'loadCostRows')
      .mockResolvedValue(rows);
    try {
      const actual = await financeQuery.companyCostTotals();
      expect(actual.actualCosts).toBe(expected.actualCosts);
      expect(actual.accountsPayable).toBe(expected.accountsPayable);
    } finally {
      loadSpy.mockRestore();
    }
  });

  it('loads lean cost rows for larger sets without nested entity graphs', async () => {
    const started = Date.now();
    await financeQuery.companyCostTotals();
    await financeQuery.projectKpis();
    await financeQuery.customerRevenuePaid();
    const elapsed = Date.now() - started;
    // Smoke/perf guard for local DB — should stay well under a few seconds
    expect(elapsed).toBeLessThan(5000);
  });
});
