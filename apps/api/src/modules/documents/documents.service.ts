import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { UpdateDocumentDto } from './dto/update-document.dto';
import type { UploadDocumentDto } from './dto/upload-document.dto';
import { StorageService } from './storage.service';
import { isOleCompound, sniffMimeType } from './mime-sniff';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

/** Declared MIME → accepted sniffed families */
const MIME_FAMILY: Record<string, string[]> = {
  'application/pdf': ['application/pdf'],
  'image/jpeg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/webp': ['image/webp'],
  'image/gif': ['image/gif'],
  'text/plain': ['text/plain'],
  'application/zip': ['application/zip'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'application/zip',
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    'application/zip',
  ],
  'application/msword': ['ole'],
  'application/vnd.ms-excel': ['ole'],
};

const documentInclude = {
  project: {
    select: { id: true, projectNumber: true, name: true },
  },
  uploadedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.DocumentInclude;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private serialize(
    document: Prisma.DocumentGetPayload<{ include: typeof documentInclude }>,
  ) {
    return {
      id: document.id,
      title: document.title,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      category: document.category,
      description: document.description,
      projectId: document.projectId,
      uploadedById: document.uploadedById,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      project: document.project,
      uploadedBy: document.uploadedBy,
    };
  }

  private assertAllowedFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const maxBytes = this.storage.getMaxUploadBytes();
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds maximum size of ${maxBytes} bytes`,
      );
    }

    const declared = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(declared)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype || 'unknown'}`,
      );
    }

    const sniffed = sniffMimeType(file.buffer);
    const family = MIME_FAMILY[declared] ?? [];
    const matchesSniff =
      (sniffed && family.includes(sniffed)) ||
      (family.includes('ole') && isOleCompound(file.buffer));

    if (!matchesSniff) {
      throw new BadRequestException(
        'File content does not match the declared type',
      );
    }
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    projectId?: string;
    category?: DocumentCategory;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim();

    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { originalFileName: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include: documentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: data.map((document) => this.serialize(document)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: documentInclude,
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return this.serialize(document);
  }

  async getDownload(id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (!(await this.storage.fileExists(document.storageKey))) {
      throw new NotFoundException('Stored file is missing');
    }

    return {
      stream: await this.storage.openReadStream(document.storageKey),
      mimeType: document.mimeType,
      originalFileName: document.originalFileName,
      sizeBytes: document.sizeBytes,
    };
  }

  async upload(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    actorId: string,
  ) {
    this.assertAllowedFile(file);

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException('Project not found');
      }
    }

    const saved = await this.storage.saveUpload(file);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            title: dto.title?.trim() || null,
            originalFileName: file.originalname,
            storageKey: saved.storageKey,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            category: dto.category ?? DocumentCategory.OTHER,
            description: dto.description?.trim() || null,
            projectId: dto.projectId || null,
            uploadedById: actorId,
          },
          include: documentInclude,
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'DOCUMENT_UPLOADED',
            entityType: 'Document',
            entityId: document.id,
            newValue: {
              originalFileName: document.originalFileName,
              category: document.category,
              projectId: document.projectId,
              sizeBytes: document.sizeBytes,
            },
          },
        });

        if (document.projectId && document.project) {
          await this.notifications.notifyProjectManager(
            document.projectId,
            {
              title: 'Neues Dokument',
              message: `${document.title || document.originalFileName} wurde zu ${document.project.projectNumber} hochgeladen`,
              type: 'document.uploaded',
              link: `/projects/${document.projectId}?tab=documents`,
            },
            { excludeUserId: actorId, tx },
          );
        }

        return this.serialize(document);
      });
    } catch (error) {
      await this.storage.deleteFile(saved.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async update(id: string, dto: UpdateDocumentDto, actorId: string) {
    const existing = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        throw new BadRequestException('Project not found');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.update({
        where: { id },
        data: {
          title: dto.title === undefined ? undefined : dto.title.trim() || null,
          category: dto.category,
          description:
            dto.description === undefined
              ? undefined
              : dto.description.trim() || null,
          projectId: dto.projectId === undefined ? undefined : dto.projectId,
        },
        include: documentInclude,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'DOCUMENT_UPDATED',
          entityType: 'Document',
          entityId: id,
          previousValue: {
            title: existing.title,
            category: existing.category,
            projectId: existing.projectId,
          },
          newValue: {
            title: document.title,
            category: document.category,
            projectId: document.projectId,
          },
        },
      });

      return this.serialize(document);
    });
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'DOCUMENT_DELETED',
          entityType: 'Document',
          entityId: id,
          previousValue: {
            originalFileName: existing.originalFileName,
            storageKey: existing.storageKey,
          },
        },
      });
    });

    return { success: true };
  }
}
