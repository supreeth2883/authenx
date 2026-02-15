import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { IssuersService } from './issuers.service.js';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('issuers')
export class IssuersController {
  constructor(private readonly issuersService: IssuersService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async register(
    @Body() body: { issuerCode: string; name: string; connectorBaseUrl: string },
  ) {
    return this.issuersService.register(body);
  }

  @Post(':issuerCode/rotate-key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async rotateKey(@Param('issuerCode') issuerCode: string) {
    return this.issuersService.rotateKey(issuerCode);
  }

  @Get(':issuerCode/public-keys')
  async getPublicKeys(@Param('issuerCode') issuerCode: string) {
    return this.issuersService.getPublicKeys(issuerCode);
  }
}
