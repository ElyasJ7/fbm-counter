import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthUserDto } from '@fbm/shared';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings:read')
  get() {
    return this.settingsService.get();
  }

  @Patch()
  @RequirePermissions('settings:write')
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthUserDto) {
    return this.settingsService.update(dto, user.id);
  }
}
