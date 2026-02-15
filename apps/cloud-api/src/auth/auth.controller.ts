import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { ThrottleAuth } from '../throttle/throttle.decorators.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ThrottleAuth() // 5 req/min - brute force protection
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);

    // Set httpOnly cookie
    // In production on Render, web and API are on different subdomains
    // so we need sameSite: 'none' + secure: true for cross-origin cookies
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', result.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    return result;
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.role);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', { path: '/' });
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return (req as any).user;
  }
}
