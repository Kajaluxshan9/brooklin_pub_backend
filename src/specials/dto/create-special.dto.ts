import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEnum,
  IsDate,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpecialType, DayOfWeek, SpecialCategory } from '../../entities/special.entity';

export class CreateSpecialDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(SpecialType)
  type: SpecialType;

  // For DAILY specials
  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  // For DAILY specials - category (regular or late night)
  @IsOptional()
  @IsEnum(SpecialCategory)
  specialCategory?: SpecialCategory;

  // For SEASONAL specials - display dates (UTC timestamps)
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  displayStartDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  displayEndDate?: Date;

  // For SEASONAL specials - special period dates (UTC timestamps)
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  specialStartDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  specialEndDate?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  @IsOptional()
  imageUrls?: string[];

  @IsOptional()
  sortOrder?: number;
}
