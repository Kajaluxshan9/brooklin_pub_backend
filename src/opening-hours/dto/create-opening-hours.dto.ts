import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

// Helper function to normalize time format (strip seconds if present)
const normalizeTime = (value: string | null): string | null => {
  if (!value) return null;
  // If time has seconds (HH:MM:SS), strip them to get HH:MM
  const match = value.match(/^(\d{1,2}:\d{2})(:\d{2})?$/);
  return match ? match[1] : value;
};

export class CreateOpeningHoursDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  @ValidateIf((o: any) => o.isOpen !== false)
  @IsString()
  @Transform(({ value }) => normalizeTime(value))
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'openTime must be in HH:MM format',
  })
  openTime: string | null;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  @ValidateIf((o: any) => o.isOpen !== false)
  @IsString()
  @Transform(({ value }) => normalizeTime(value))
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'closeTime must be in HH:MM format',
  })
  closeTime: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isOpen?: boolean;

  @IsBoolean()
  @IsOptional()
  isClosedNextDay?: boolean;

  @IsString()
  @IsOptional()
  specialNote?: string;
}
