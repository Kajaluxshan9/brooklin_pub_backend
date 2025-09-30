import {
  IsString,
  IsEnum,
  IsDate,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EventType {
  LIVE_MUSIC = 'live_music',
  TRIVIA = 'trivia',
  SPORTS = 'sports',
  SPECIAL_DINNER = 'special_dinner',
  PARTY = 'party',
  OTHER = 'other',
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(EventType)
  type: EventType;

  @IsDate()
  @Type(() => Date)
  startDateTime: Date;

  @IsDate()
  @Type(() => Date)
  endDateTime: Date;

  @IsNumber()
  @Min(1)
  capacity: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  currentBookings?: number;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsString()
  @IsOptional()
  recurringDays?: string;

  @IsBoolean()
  @IsOptional()
  requiresReservation?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
