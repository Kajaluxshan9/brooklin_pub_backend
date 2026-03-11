import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
  IsUrl,
} from 'class-validator';
import {
  AnnouncementType,
  AnnouncementPriority,
} from '../../entities/announcement.entity';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Content is required' })
  content: string;

  @IsEnum(AnnouncementType, { message: 'Invalid announcement type' })
  type: AnnouncementType;

  @IsEnum(AnnouncementPriority, { message: 'Invalid priority level' })
  @IsOptional()
  priority?: AnnouncementPriority;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  ctaText?: string;

  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'CTA URL must be a valid URL' })
  ctaUrl?: string;
}
