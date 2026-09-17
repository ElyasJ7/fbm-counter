import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @RequirePermissions('projects:read')
  search(@Query('q') q?: string) {
    return this.searchService.search(q ?? '');
  }
}
