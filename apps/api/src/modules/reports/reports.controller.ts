import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { REPORT_EXPORT_TYPES, type ReportExportType } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @RequirePermissions('reports:read')
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getSummary({ from, to });
  }

  @Get('export')
  @RequirePermissions('reports:export')
  async export(
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    const exportType = (
      REPORT_EXPORT_TYPES.includes(type as ReportExportType) ? type : 'summary'
    ) as ReportExportType;

    if (format === 'pdf') {
      const file = await this.reportsService.exportPdf(exportType, {
        from,
        to,
      });
      const encodedName = encodeURIComponent(file.filename);
      return new StreamableFile(file.buffer, {
        type: 'application/pdf',
        disposition: `attachment; filename="${file.filename}"; filename*=UTF-8''${encodedName}`,
      });
    }

    const file = await this.reportsService.exportCsv(exportType, {
      from,
      to,
    });

    const encodedName = encodeURIComponent(file.filename);
    return new StreamableFile(Buffer.from(file.content, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${file.filename}"; filename*=UTF-8''${encodedName}`,
    });
  }
}
