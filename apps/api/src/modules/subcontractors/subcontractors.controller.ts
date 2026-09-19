import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SubcontractorTrade } from '@prisma/client';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignProjectDto } from './dto/assign-project.dto';
import { CreateSubcontractorDto } from './dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from './dto/update-subcontractor.dto';
import { SubcontractorsService } from './subcontractors.service';

@Controller('subcontractors')
export class SubcontractorsController {
  constructor(private readonly subcontractorsService: SubcontractorsService) {}

  @Get()
  @RequirePermissions('subcontractors:read')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('trade') trade?: SubcontractorTrade,
  ) {
    return this.subcontractorsService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      trade,
    });
  }

  @Get(':id')
  @RequirePermissions('subcontractors:read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.subcontractorsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('subcontractors:write')
  create(
    @Body() dto: CreateSubcontractorDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.subcontractorsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('subcontractors:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubcontractorDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.subcontractorsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('subcontractors:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.subcontractorsService.remove(id, user.id);
  }

  @Post(':id/projects')
  @RequirePermissions('subcontractors:write')
  assignProject(
    @Param('id') id: string,
    @Body() dto: AssignProjectDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.subcontractorsService.assignProject(id, dto, user.id);
  }

  @Delete(':id/projects/:projectId')
  @RequirePermissions('subcontractors:write')
  unassignProject(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.subcontractorsService.unassignProject(id, projectId, user.id);
  }
}
