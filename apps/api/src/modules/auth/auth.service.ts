import { Injectable, UnauthorizedException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DbService } from '../db/db.service';

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
    private readonly dbService: DbService
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
}
