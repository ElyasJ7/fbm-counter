import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
} from '@fbm/shared';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  vatId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bic?: string;

  /** Company base / books currency. */
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  defaultCurrency?: string;

  /** Default UI display / reporting currency. */
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  defaultDisplayCurrency?: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_TIMEZONES])
  timezone?: string;

  @IsOptional()
  @IsNumberString()
  defaultVatRate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  invoicePrefix?: string;
}
