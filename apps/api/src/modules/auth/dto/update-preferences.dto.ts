import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '@fbm/shared';

export class UpdatePreferencesDto {
  /** Set to AFN/EUR/USD, or empty/null to clear and use company default. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  preferredDisplayCurrency?: string | null;
}
