import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  BudgetCategory,
  ExpenseStatus,
  PaymentMethod,
} from '@prisma/client';

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  expenseNumber?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(BudgetCategory)
  category?: BudgetCategory;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsNumberString()
  netAmount!: string;

  @IsOptional()
  @IsNumberString()
  taxRate?: string;

  @IsOptional()
  @IsNumberString()
  paidAmount?: string;

  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
