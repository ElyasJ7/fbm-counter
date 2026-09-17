import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/** Controlled expense payment — not available via generic PATCH. */
export class RecordExpensePaymentDto {
  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
