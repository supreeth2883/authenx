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
 * All verification goes through this controller.
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
    return this.credentialsService.verify(id, {
      orgName: orgName || 'Employer Verification',
      actor,
      ipAddress,
    });
  }
}
