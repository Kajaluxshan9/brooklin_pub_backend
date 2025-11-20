import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
  IsBoolean,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'super_admin'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
