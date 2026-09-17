import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.auditService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      entityType,
      action,
      actorId,
      entityId,
      from,
      to,
      search,
    });
  }

  @Get('entity-types')
  @RequirePermissions('audit:read')
  listEntityTypes() {
    return this.auditService.listEntityTypes();
  }

  @Get(':id')
  @RequirePermissions('audit:read')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
