import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class RegisterDto {
  name: string;
  email: string;
  password?: string;
}

class LoginDto {
  email: string;
  password?: string;
}

@ApiTags('User Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new QueueWatch SRE account' })
  @ApiResponse({ status: 201, description: 'Return signed JWT token and user profile.' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.name, body.email, body.password || '');
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Return signed JWT token and user profile.' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password || '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve active authenticated SRE profile' })
  @ApiResponse({ status: 200, description: 'Return authenticated user metadata.' })
  async getProfile(@Request() req: any) {
    return req.user;
  }
}
