import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds: number;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
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

    const payload = { email: user.email, sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);

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
    const { email, password, firstName, lastName, role } = registerDto;

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
      role: role || 'admin',
    });

    await this.userRepository.save(user);

    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
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

    // In a real application, you would send an email with a reset token
    // For now, we'll just return a success message
    return { message: 'If the email exists, a reset link has been sent' };
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
}
