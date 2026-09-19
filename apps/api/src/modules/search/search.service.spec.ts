import { BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';

describe('SearchService', () => {
  const projectAccess = {
    projectWhere: () => ({}),
    invoiceWhere: () => ({}),
    expenseWhere: () => ({}),
    documentWhere: () => ({}),
  };
  const service = new SearchService({} as never, projectAccess as never);

  it('rejects short queries', async () => {
    await expect(service.search('a', {} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.search(' ', {} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
