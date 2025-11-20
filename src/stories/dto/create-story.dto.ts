import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
} from 'class-validator';

export class CreateStoryDto {
  @IsString()
  categoryId: string;

  @IsArray()
  @IsOptional()
  imageUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
