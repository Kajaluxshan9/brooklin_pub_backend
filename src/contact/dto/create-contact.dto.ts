import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContactDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phone?: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(
    [
      'general',
      'reservation',
      'event',
      'catering',
      'feedback',
      'careers',
      'other',
    ],
    { message: 'Please select a valid subject' },
  )
  subject: string;

  @IsOptional()
  @IsString()
  reservationDate?: string;

  @IsOptional()
  @IsString()
  reservationTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Guest count must be a whole number' })
  @Min(1, { message: 'Guest count must be at least 1' })
  @Max(10000, { message: 'Guest count must not exceed 10000' })
  guestCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Position must not exceed 100 characters' })
  position?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Message must be at least 10 characters' })
  @MaxLength(2000, { message: 'Message must not exceed 2000 characters' })
  message: string;
}
