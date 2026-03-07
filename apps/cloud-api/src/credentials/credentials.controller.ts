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
  @ThrottleVerify()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COLLEGE_ADMIN)
  async issue(@Body() body: IssueCredentialDto) {
    return this.credentialsService.issue(body);
  }

  /**
   * GET /credentials/:id/verify — authenticated verification (employer flow)
   */
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

  /**
   * GET /credentials/:id — public credential lookup (no auth)
   */
  @Get(':id')
  @ThrottleVerify()
  async findById(@Param('id') id: string) {
    const credential = await this.credentialsService.findById(id);
    if (!credential) {
      throw new HttpException(
        { error: 'NOT_FOUND', message: 'Credential not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    // Return public-safe fields only (no signature)
    return {
      credentialId: credential.id,
      issuerCode: credential.issuerCode,
      name: credential.name,
      rollNumber: credential.rollNumber,
      degree: credential.degree,
      branch: credential.branch,
      graduationYear: credential.graduationYear,
      cgpa: credential.cgpa,
      status: credential.status,
      issuedAt: credential.issuedAt ?? credential.createdAt,
      revokedAt: credential.revokedAt,
      revocationReason: credential.revocationReason,
    };
  }
}

/**
 * Public verification controller — no auth required.
 * Used by verifier dashboard and external systems.
 */
@Controller('verify')
export class PublicVerifyController {
  private readonly logger = new Logger(PublicVerifyController.name);

  constructor(private readonly credentialsService: CredentialsService) {}

  /**
   * GET /verify/:id — public cryptographic verification
   */
  @Get(':id')
  @ThrottleVerify()
  async verifyPublic(
    @Param('id') id: string,
    @Query('orgName') orgName?: string,
    @Req() req?: Request,
  ) {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for']?.toString() || 'unknown';
    return this.credentialsService.verify(id, {
      orgName: orgName || 'public',
      actor: 'public',
      ipAddress,
    });
  }
}
