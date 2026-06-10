import { Injectable, UnauthorizedException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DbService } from '../db/db.service';
import { MailService } from './mail.service';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly jwtService: JwtService,
    private readonly dbService: DbService,
    private readonly mailService: MailService
  ) {}

  async onModuleInit() {
    const demoEmail = 'demo@queuewatch.dev';
    const demoPassword = 'password123';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);

    const existing = await this.dbService.getUser(demoEmail);
    if (!existing) {
      await this.dbService.saveUser({
        id: 'demo_user_sre_910',
        name: 'SRE Demo Admin',
        email: demoEmail.toLowerCase(),
        passwordHash: hashedPassword,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async register(name: string, email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.dbService.getUser(normalizedEmail);
    
    if (existing) {
      throw new BadRequestException('Account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const user: User = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    await this.dbService.saveUser(user);

    // Send Welcome Email asynchronously
    this.mailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
      // Log failure but do not fail registration
      console.error('Failed to send welcome email:', err);
    });

    const payload = { sub: user.id, email: user.email, name: user.name };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.dbService.getUser(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const payload = { sub: user.id, email: user.email, name: user.name };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  async validateUserById(id: string): Promise<any> {
    // Search the database
    // For simplicity, retrieve a list of keys or fetch the standard demo user or query via redis keys pattern
    const redis = this.dbService.getRedis();
    if (!redis) return null;
    const keys = await redis.keys('queuewatch:users:*');
    for (const key of keys) {
      const raw = await redis.get(key);
      if (raw) {
        const user = JSON.parse(raw);
        if (user.id === id) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
          };
        }
      }
    }
    return null;
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.dbService.getUser(normalizedEmail);

    if (user) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const redis = this.dbService.getRedis();
      await redis.set(`queuewatch:otp:${normalizedEmail}`, otpCode, 'EX', 600); // 10 minutes TTL

      // Send OTP email asynchronously
      this.mailService.sendOtpEmail(normalizedEmail, user.name || user.username || 'Operator', otpCode).catch((err) => {
        console.error('Failed to send recovery OTP email:', err);
      });
    }

    return {
      message: 'If the email is registered, a recovery OTP has been sent.',
    };
  }

  async resetPassword(email: string, otp: string, newPassword?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const redis = this.dbService.getRedis();
    const cachedOtp = await redis.get(`queuewatch:otp:${normalizedEmail}`);

    if (!cachedOtp || cachedOtp !== otp.trim()) {
      throw new BadRequestException('Invalid or expired recovery OTP code.');
    }

    const user = await this.dbService.getUser(normalizedEmail);
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    if (!newPassword || newPassword.trim().length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashedPassword;
    await this.dbService.saveUser(user);

    // Clean up OTP key
    await redis.del(`queuewatch:otp:${normalizedEmail}`);

    return {
      success: true,
      message: 'Access key configured successfully. Please sign in with your new password.',
    };
  }

  async contactSupport(email: string, message: string) {
    if (!email || !email.trim()) {
      throw new BadRequestException('Email is required.');
    }
    if (!message || !message.trim()) {
      throw new BadRequestException('Message is required.');
    }

    // Call mailService
    this.mailService.sendContactEmails(email.trim(), message.trim()).catch((err) => {
      console.error('Failed to process support email dispatch:', err);
    });

    return {
      success: true,
      message: 'Support query received and notifications dispatched.',
    };
  }
}
