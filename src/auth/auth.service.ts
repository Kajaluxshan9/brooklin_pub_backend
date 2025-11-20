import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptSaltRounds: number;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {
    this.bcryptSaltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'),
      10,
    );
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email address before logging in. Check your inbox for the verification link.',
      );
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);

    // Update last login time
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'phone'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phone, role, isActive } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, this.bcryptSaltRounds);

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || undefined,
      role: role || 'admin',
      isActive: isActive !== undefined ? isActive : true,
      isEmailVerified: false, // New users must verify email
    });

    await this.userRepository.save(user);

    // Generate and send verification email
      let emailSent = false;
      try {
        await this.generateAndSendVerificationEmail(user);
        emailSent = true;
      } catch (err) {
        // Already logged; proceed without blocking registration
        emailSent = false;
      }

      return {
        message: emailSent
          ? 'User registered successfully. Please check your email to verify your account.'
          : 'User registered successfully. We attempted to send a verification email but failed. Please check your email settings or contact support.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  private async generateAndSendVerificationEmail(user: User) {
    // Generate secure token and hash to store in DB
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiryMs = 1000 * 60 * 10; // 10 minutes
    const expiryDate = new Date(Date.now() + expiryMs);

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiry = expiryDate;
    await this.userRepository.save(user);

    // Build verification URL
    const frontendBase = this.configService.get<string>('FRONTEND_URL');
    if (!frontendBase) {
      throw new Error('FRONTEND_URL environment variable is not configured');
    }
    const verificationUrl = `${frontendBase.replace(/\/$/, '')}/verify-email?token=${token}`;

    // Log the verification URL in development for easier debugging
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`Verification URL for ${user.email}: ${verificationUrl}`);
    }

    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        verificationUrl,
      );
    } catch (err) {
      // Log error but don't block registration
      this.logger.error('Failed to send verification email', err as any);
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(
      newPassword,
      this.bcryptSaltRounds,
    );

    user.password = hashedNewPassword;
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists for security
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate secure token and hash to store in DB
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiryMs = 1000 * 60 * 60; // 1 hour
    const expiryDate = new Date(Date.now() + expiryMs);

    user.passwordResetToken = hashedToken;
    user.passwordResetTokenExpiry = expiryDate;
    await this.userRepository.save(user);

    // Build reset URL (frontend handles token in query param)
    const frontendBase = this.configService.get<string>('FRONTEND_URL');
    if (!frontendBase) {
      throw new Error('FRONTEND_URL environment variable is not configured');
    }
    // If a specific path is provided in env, use it otherwise default to /reset-password
    const resetPath = this.configService.get<string>('PASSWORD_RESET_PATH') || '/reset-password';
    const resetUrl = `${frontendBase.replace(/\/$/, '')}${resetPath}?token=${token}&email=${encodeURIComponent(user.email)}`;

    try {
      await this.mailService.sendResetPasswordEmail(
        user.email,
        user.firstName,
        resetUrl,
      );
    } catch (err) {
      // Log and continue, but still return success response to avoid leaking info
      // We won't throw since we don't want to leak whether email sent or not
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword, confirmPassword } = resetPasswordDto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Find user by hashed token and ensure it's not expired
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: hashedToken },
    });

    if (
      !user ||
      !user.passwordResetTokenExpiry ||
      user.passwordResetTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedNewPassword = await bcrypt.hash(
      newPassword,
      this.bcryptSaltRounds,
    );
    user.password = hashedNewPassword;
    // Clear reset token
    user.passwordResetToken = null;
    user.passwordResetTokenExpiry = null;
    await this.userRepository.save(user);

    try {
      await this.mailService.sendPasswordChangedConfirmation(
        user.email,
        user.firstName,
      );
    } catch (err) {
      // Log, but don't block.
    }

    return { message: 'Password has been reset successfully' };
  }

  async createSuperAdmin() {
    const superAdminEmail = this.configService.get<string>(
      'SUPER_ADMIN_EMAIL',
      'admin@example.com',
    );
    const superAdminPassword = this.configService.get<string>(
      'SUPER_ADMIN_PASSWORD',
      'ChangeMe123!',
    );
    const superAdminFirstName = this.configService.get<string>(
      'SUPER_ADMIN_FIRST_NAME',
      'Super',
    );
    const superAdminLastName = this.configService.get<string>(
      'SUPER_ADMIN_LAST_NAME',
      'Admin',
    );

    const existingUser = await this.userRepository.findOne({
      where: { email: superAdminEmail },
    });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(
        superAdminPassword,
        this.bcryptSaltRounds,
      );

      const superAdmin = this.userRepository.create({
        email: superAdminEmail,
        password: hashedPassword,
        firstName: superAdminFirstName,
        lastName: superAdminLastName,
        role: 'super_admin',
        isEmailVerified: true, // Super admin is pre-verified
      });

      await this.userRepository.save(superAdmin);
      console.log(
        `Super admin created successfully with email: ${superAdminEmail}`,
      );
    }
  }

  async findAllUsers() {
    return await this.userRepository.find({
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'phone',
        'role',
        'isActive',
        'isEmailVerified',
        'createdAt',
        'lastLoginAt',
      ],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findUserById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'phone',
        'role',
        'isActive',
        'isEmailVerified',
        'createdAt',
        'lastLoginAt',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async toggleUserStatus(id: string) {
    const user = await this.findUserById(id);
    user.isActive = !user.isActive;
    return await this.userRepository.save(user);
  }

  async deleteUser(id: string) {
    const user = await this.findUserById(id);
    await this.userRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findUserById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const { password, confirmPassword, ...rest } = updateUserDto;

    if (password) {
      if (confirmPassword && password !== confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }
      user.password = await bcrypt.hash(password, this.bcryptSaltRounds);
    }

    Object.assign(user, rest);

    const saved = await this.userRepository.save(user);

    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      phone: saved.phone,
      role: saved.role,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
      lastLoginAt: saved.lastLoginAt,
    };
  }

  async verifyEmail(token: string) {
    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`verifyEmail called with token hash ${hashedToken}`);
    }

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: hashedToken },
    });

    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`verifyEmail: No user found for token hash ${hashedToken}`);
      }
      throw new BadRequestException(
        'Invalid or expired verification token. Please request a new verification email.',
      );
    }

    if (!user.emailVerificationTokenExpiry || user.emailVerificationTokenExpiry < new Date()) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          `verifyEmail: Token expired for user ${user.email} - expiry: ${user.emailVerificationTokenExpiry}`,
        );
      }
      throw new BadRequestException(
        'Invalid or expired verification token. Please request a new verification email.',
      );
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiry = null;
    await this.userRepository.save(user);

    // Send success confirmation email
    try {
      await this.mailService.sendVerificationSuccessEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
      );
    } catch (err) {
      // Log but don't block
      console.error('Failed to send verification success email:', err);
    }

    return {
      message: 'Email verified successfully. You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification email
    await this.generateAndSendVerificationEmail(user);

    return {
      message: 'Verification email sent successfully. Please check your inbox.',
    };
  }

  async resendVerificationEmailByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists for security
      return {
        message:
          'If an unverified account exists with this email, a verification link has been sent.',
      };
    }

    if (user.isEmailVerified) {
      return {
        message:
          'If an unverified account exists with this email, a verification link has been sent.',
      };
    }

    // Generate new verification email
    await this.generateAndSendVerificationEmail(user);

    return {
      message:
        'If an unverified account exists with this email, a verification link has been sent.',
    };
  }
}
