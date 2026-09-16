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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: ProjectStatus,
    @Query('customerId') customerId?: string,
  ) {
    return this.projectsService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      status,
      customerId,
    });
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @RequirePermissions('projects:write')
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUserDto) {
    return this.projectsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('projects:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.projectsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.projectsService.remove(id, user.id);
  }
}
