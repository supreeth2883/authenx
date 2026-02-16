import { Controller, Post, Get, Param, Body, Query, Logger, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { CredentialsService } from './credentials.service.js';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ThrottleVerify } from '../throttle/throttle.decorators.js';
import type { Request } from 'express';

import { IssueCredentialDto } from './dto/issue-credential.dto.js';

@Controller('credentials')
export class CredentialsController {
  private readonly logger = new Logger(CredentialsController.name);

  constructor(
    private readonly credentialsService: CredentialsService,
  ) {}

  @Post('issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COLLEGE_ADMIN)
  async issue(@Body() body: IssueCredentialDto) {
    return this.credentialsService.issue(body);
  }

  @Get(':id/verify')
  @ThrottleVerify()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  async verify(
    @Param('id') id: string,
    @Query('orgName') orgName?: string,
    @Req() req?: Request,
  ) {
    const actor = (req as any)?.user?.email || 'unknown';
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for']?.toString() || 'unknown';
    return this.credentialsService.verify(id, { orgName, actor, ipAddress });
  }
}
