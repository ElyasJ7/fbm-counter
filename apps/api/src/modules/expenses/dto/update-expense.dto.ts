import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BudgetCategory, ExpenseStatus, PaymentMethod } from '@prisma/client';
import { SUPPORTED_CURRENCIES } from '@fbm/shared';

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  expenseNumber?: string;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsEnum(BudgetCategory)
  category?: BudgetCategory;

  @IsOptional()
  @IsString()
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string | null;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsNumberString()
  netAmount?: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  currency?: string;

  @IsOptional()
  @IsNumberString()
  taxRate?: string;

  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string | null;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
