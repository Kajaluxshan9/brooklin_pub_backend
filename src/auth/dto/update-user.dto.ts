import { PartialType } from '@nestjs/mapped-types';
import { RegisterDto } from './register.dto';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsEmail,
  MinLength,
} from 'class-validator';

export class UpdateUserDto extends PartialType(RegisterDto) {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  phone?: string;
}
