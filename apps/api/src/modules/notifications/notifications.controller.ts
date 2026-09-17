import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications:read')
  findAll(
    @CurrentUser() user: AuthUserDto,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findAllForUser(user.id, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  @RequirePermissions('notifications:read')
  unreadCount(@CurrentUser() user: AuthUserDto) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch(':id/read')
  @RequirePermissions('notifications:read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUserDto) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post('read-all')
  @RequirePermissions('notifications:read')
  markAllRead(@CurrentUser() user: AuthUserDto) {
    return this.notificationsService.markAllRead(user.id);
  }
}
