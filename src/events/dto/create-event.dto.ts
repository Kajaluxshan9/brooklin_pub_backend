import {
  IsString,
  IsEnum,
  IsDate,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EventType {
  LIVE_MUSIC = 'live_music',
  SPORTS_VIEWING = 'sports_viewing',
  TRIVIA_NIGHT = 'trivia_night',
  KARAOKE = 'karaoke',
  PRIVATE_PARTY = 'private_party',
  SPECIAL_EVENT = 'special_event',
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
  displayStartDate: Date;

  @IsDate()
  @Type(() => Date)
  displayEndDate: Date;

  @IsDate()
  @Type(() => Date)
  eventStartDate: Date;

  @IsDate()
  @Type(() => Date)
  eventEndDate: Date;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
