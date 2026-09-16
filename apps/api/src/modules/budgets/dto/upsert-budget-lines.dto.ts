import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BudgetCategory } from '@prisma/client';

export class UpsertBudgetLineDto {
  @IsEnum(BudgetCategory)
  category!: BudgetCategory;

  @IsNumberString()
  plannedAmount!: string;

  @IsOptional()
  @IsNumberString()
  committedAmount?: string;

  @IsOptional()
  @IsNumberString()
  actualAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpsertBudgetLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertBudgetLineDto)
  lines!: UpsertBudgetLineDto[];
}
