import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Res,
  Patch,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Set the JWT token as an httpOnly cookie (1 hour validity)
    const cookieMaxAge = parseInt(process.env.COOKIE_MAX_AGE || '3600000', 10); // 1 hour in milliseconds
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: cookieMaxAge,
    });

    // Return user data without the token
    return {
      user: result.user,
      message: 'Login successful',
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.authService.getProfile(req.user.userId as string);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      req.user.userId as string,
      changePasswordDto,
    );
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return req.user;
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: any,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.authService.updateUser(req.user.userId, updateUserDto);
  }
}
