import { NumberingService } from './numbering.service';

describe('NumberingService', () => {
  it('allocates increasing values from raw SQL upsert', async () => {
    const calls: unknown[] = [];
    const tx = {
      $queryRaw: (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<Array<{ next_value: number }>> => {
        calls.push({ strings: strings.join('?'), values });
        if (String(strings.join('')).includes('RETURNING')) {
          const next =
            calls.filter((c) =>
              String((c as { strings: string }).strings).includes('RETURNING'),
            ).length === 1
              ? 5
              : 6;
          return Promise.resolve([{ next_value: next }]);
        }
        return Promise.resolve([]);
      },
      $executeRaw: (): Promise<number> => Promise.resolve(1),
    };

    const service = new NumberingService({} as never);
    const a = await service.allocateNext('invoice:RE-2026-', tx as never);
    const b = await service.allocateNext('invoice:RE-2026-', tx as never);
    expect(a).toBe(5);
    expect(b).toBe(6);
  });
});
