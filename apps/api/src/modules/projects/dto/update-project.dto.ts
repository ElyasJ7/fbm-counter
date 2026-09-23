import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';
import { SUPPORTED_CURRENCIES } from '@fbm/shared';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  projectNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerContact?: string;

  @IsOptional()
  @IsString()
  projectManagerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  siteStreet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sitePostalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  siteCountry?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @IsDateString()
  expectedCompletionDate?: string | null;

  @IsOptional()
  @IsDateString()
  actualCompletionDate?: string | null;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsNumberString()
  contractValue?: string;

  @IsOptional()
  @IsNumberString()
  initialBudget?: string;

  @IsOptional()
  @IsNumberString()
  currentBudget?: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_CURRENCIES])
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
