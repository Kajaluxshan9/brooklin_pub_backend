import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMenuItemMeasurementDto } from './create-menu-item-measurement.dto';

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  price?: number; // Optional now, can use measurements instead

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

  @IsBoolean()
  @IsOptional()
  hasMeasurements?: boolean; // If true, use measurements; if false, use price

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMenuItemMeasurementDto)
  @IsOptional()
  measurements?: CreateMenuItemMeasurementDto[];
}
