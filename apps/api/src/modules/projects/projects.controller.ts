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
import { ProjectStatus } from '@prisma/client';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @RequirePermissions('projects:read')
  findAll(
    @CurrentUser() user: AuthUserDto,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: ProjectStatus,
    @Query('customerId') customerId?: string,
    @Query('projectManagerId') projectManagerId?: string,
  ) {
    return this.projectsService.findAll(
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        search,
        status,
        customerId,
        projectManagerId,
      },
      user,
    );
  }

  @Get(':id/subcontractors')
  @RequirePermissions('subcontractors:read')
  listSubcontractors(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.projectsService.listSubcontractors(id, user);
  }

  @Get(':id/activity')
  @RequirePermissions('audit:read')
  listActivity(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.projectsService.listActivity(id, user);
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.projectsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('projects:write')
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUserDto) {
    return this.projectsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('projects:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.projectsService.remove(id, user);
  }
}
