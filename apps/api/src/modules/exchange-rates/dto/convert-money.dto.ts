import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsIn, IsNumberString } from 'class-validator';
import { SUPPORTED_CURRENCIES } from '@fbm/shared';

export class ConvertMoneyDto {
  @IsNumberString()
  amount!: string;

  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  fromCurrency!: string;

  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  toCurrency!: string;

  /** ISO timestamp — when set, uses historical rate (accounting path). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  asOf?: string;
}
