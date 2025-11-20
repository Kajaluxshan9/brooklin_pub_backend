import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateStoryCategoryDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
