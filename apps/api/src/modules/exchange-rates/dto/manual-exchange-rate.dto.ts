import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsIn } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '@fbm/shared';

export class ManualExchangeRateDto {
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  baseCurrency!: string;

  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  quoteCurrency!: string;

  @IsNumberString()
  rate!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  effectiveAt?: string;
}
