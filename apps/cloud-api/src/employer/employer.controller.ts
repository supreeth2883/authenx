import { Controller, Get, Param, Query, Req, Logger, UseGuards } from '@nestjs/common';
import { CredentialsService } from '../credentials/credentials.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import { ThrottleVerify } from '../throttle/throttle.decorators.js';
import type { Request } from 'express';

/**
 * Employer verification portal — EMPLOYER role only.
 * Returns only minimal safe fields — NO student PII (name, CGPA, roll number, etc.).
 * This is the ONLY verification endpoint. Public verification is disabled.
 */
@Controller('employer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYER)
export class EmployerController {
  private readonly logger = new Logger(EmployerController.name);

  constructor(private readonly credentialsService: CredentialsService) {}

  @Get('verify/:id')
  @ThrottleVerify()
  async verify(
    @Param('id') id: string,
    @Query('orgName') orgName?: string,
    @Req() req?: Request,
  ) {
    const actor = (req as any)?.user?.email || 'unknown';
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for']?.toString() || 'unknown';
    this.logger.log(`Employer verify request for credential ${id} by ${actor}`);

    // Full verification (hash + signature + audit)
    const full = await this.credentialsService.verify(id, {
      orgName: orgName || 'Employer Verification',
      actor,
      ipAddress,
    });

    // Strip PII — return only safe, minimal fields
    return {
      credentialId: full.credentialId,
      issuerCode: full.issuerCode,
      issuedAt: full.issuedAt,
      status: full.status,
      revokedAt: full.revokedAt ?? null,
      verification: {
        hashValid: full.verification.hashValid,
        signatureValid: full.verification.signatureValid,
        verified: full.verification.verified,
        revoked: full.verification.revoked,
        tamperDetected: full.verification.tamperDetected,
        verifiedAt: full.verification.verifiedAt,
      },
    };
  }
}
