import { Injectable, UnauthorizedException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly users = new Map<string, User>();

  constructor(private readonly jwtService: JwtService) {}

  async onModuleInit() {
    const demoEmail = 'demo@queuewatch.dev';
    const demoPassword = 'password123';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);

    this.users.set(demoEmail.toLowerCase(), {
      id: 'demo_user_sre_910',
      name: 'SRE Demo Admin',
      email: demoEmail.toLowerCase(),
      passwordHash: hashedPassword,
      createdAt: new Date(),
    });
  }

  async register(name: string, email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    
    if (this.users.has(normalizedEmail)) {
      throw new BadRequestException('Account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const user: User = {
      id,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashedPassword,
      createdAt: new Date(),
    };

    this.users.set(normalizedEmail, user);

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
    const user = this.users.get(normalizedEmail);

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
    for (const user of this.users.values()) {
      if (user.id === id) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        };
      }
    }
    return null;
  }
}
