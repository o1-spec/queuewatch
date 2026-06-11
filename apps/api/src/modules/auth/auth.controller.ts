import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class RegisterDto {
  name: string;
  email: string;
  password?: string;
  company?: string;
}

class LoginDto {
  email: string;
  password?: string;
}

class ForgotPasswordDto {
  email: string;
}

class ResetPasswordDto {
  email: string;
  otp: string;
  newPassword?: string;
}

class ContactSupportDto {
  email: string;
  message: string;
}

@ApiTags('User Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new QueueWatch SRE account' })
  @ApiResponse({ status: 201, description: 'Return signed JWT token and user profile.' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.name, body.email, body.password || '', body.company);
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Return signed JWT token and user profile.' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password || '');
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Initiate password recovery flow' })
  @ApiResponse({ status: 200, description: 'Dispatches OTP recovery code if email exists.' })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset access key using recovery OTP' })
  @ApiResponse({ status: 200, description: 'Updates user password if OTP matches.' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.email, body.otp, body.newPassword);
  }

  @Post('contact')
  @ApiOperation({ summary: 'Submit a developer support query' })
  @ApiResponse({ status: 200, description: 'Dispatches support emails to the sender and admin.' })
  async contactSupport(@Body() body: ContactSupportDto) {
    return this.authService.contactSupport(body.email, body.message);
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
