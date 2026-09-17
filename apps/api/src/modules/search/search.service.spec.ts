import { BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';

describe('SearchService', () => {
  const service = new SearchService({} as never);

  it('rejects short queries', async () => {
    await expect(service.search('a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.search(' ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
