import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { DocumentCategory } from '@prisma/client';
import type { AuthUserDto } from '@fbm/shared';
import { memoryStorage } from 'multer';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequirePermissions('documents:read')
  findAll(
    @CurrentUser() user: AuthUserDto,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('projectId') projectId?: string,
    @Query('category') category?: DocumentCategory,
  ) {
    return this.documentsService.findAll(
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        search,
        projectId,
        category,
      },
      user,
    );
  }

  @Get(':id/download')
  @RequirePermissions('documents:read')
  async download(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    const file = await this.documentsService.getDownload(id, user);
    const encodedName = encodeURIComponent(file.originalFileName);
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: `attachment; filename="${file.originalFileName.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`,
      length: file.sizeBytes,
    });
  }

  @Get(':id')
  @RequirePermissions('documents:read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.documentsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('documents:write')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_BYTES) || 10_485_760,
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.documentsService.upload(file, dto, user);
  }

  @Patch(':id')
  @RequirePermissions('documents:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: AuthUserDto,
  ) {
    return this.documentsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('documents:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.documentsService.remove(id, user);
  }
}
