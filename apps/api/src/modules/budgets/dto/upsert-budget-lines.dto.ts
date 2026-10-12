import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpsertBudgetLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  category!: string;

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
