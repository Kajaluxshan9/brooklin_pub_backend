import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @IsOptional()
  preparationTime?: number;

  @IsArray()
  @IsOptional()
  allergens?: string[];

  @IsArray()
  @IsOptional()
  dietaryInfo?: string[];

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsArray()
  @IsOptional()
  imageUrls?: string[]; // Support multiple images (up to 5)

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
