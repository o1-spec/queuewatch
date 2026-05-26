import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Authorization header format must be: Bearer <token>');
    }

    const token = parts[1];

    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.authService.validateUserById(decoded.sub);
      
      if (!user) {
        throw new UnauthorizedException('User no longer exists inside active registry.');
      }

      request.user = user;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired authentication token: ' + err.message);
    }
  }
}
