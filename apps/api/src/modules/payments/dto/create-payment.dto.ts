import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { SUPPORTED_CURRENCIES } from '@fbm/shared';

export class CreatePaymentDto {
  @IsString()
  invoiceId!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsDateString()
  paymentDate!: string;

  @IsNumberString()
  amount!: string;

  /** Optional; must match invoice currency when set (cross-currency deferred). */
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  currency?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
