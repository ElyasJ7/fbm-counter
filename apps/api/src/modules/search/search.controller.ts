import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermissions('projects:read')
  search(@Query('q') q?: string) {
    return this.searchService.search(q ?? '');
  }
}
