import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Res,
  Patch,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { LoginThrottleService } from './login-throttle.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { getOptionalEnv, getRequiredEnv } from '../config/env.validation';

/**
 * Auth cookie flags. Secure (HTTPS-only) in production by default;
 * COOKIE_SECURE=true/false overrides it for a specific environment.
 */
function authCookieOptions() {
  const override = getOptionalEnv('COOKIE_SECURE');
  const secure =
    override !== undefined
      ? override === 'true'
      : getRequiredEnv('NODE_ENV') === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private loginThrottle: LoginThrottleService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? 'unknown';
    // Blocked callers are refused before the password is even checked.
    this.loginThrottle.assertAllowed(loginDto.email, ip);

    let result: Awaited<ReturnType<AuthService['login']>>;
    try {
      result = await this.authService.login(loginDto);
    } catch (err) {
      // Only wrong email/password counts; e.g. "verify your email" does not.
      if (
        err instanceof UnauthorizedException &&
        err.message === 'Invalid credentials'
      ) {
        this.loginThrottle.recordFailure(loginDto.email, ip);
      }
      throw err;
    }
    this.loginThrottle.recordSuccess(loginDto.email);

    // Set the JWT token as an httpOnly cookie
    const cookieMaxAge = parseInt(getRequiredEnv('COOKIE_MAX_AGE'), 10);
    res.cookie('access_token', result.access_token, {
      ...authCookieOptions(),
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
    res.clearCookie('access_token', authCookieOptions());
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

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
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

  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Post('resend-verification')
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    return this.authService.resendVerificationEmailByEmail(
      resendVerificationDto.email,
    );
  }

  @Post('resend-verification/:userId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async resendVerificationForUser(@Param('userId') userId: string) {
    return this.authService.resendVerificationEmail(userId);
  }
}
