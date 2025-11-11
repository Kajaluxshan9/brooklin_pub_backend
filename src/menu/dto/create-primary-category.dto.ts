import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreatePrimaryCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
