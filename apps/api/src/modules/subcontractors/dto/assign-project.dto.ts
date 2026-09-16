import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignProjectDto {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsNumberString()
  contractValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
