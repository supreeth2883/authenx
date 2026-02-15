import { Controller, Get, Param, Query, Req, Logger } from '@nestjs/common';
import { CredentialsService } from './credentials.service.js';
import { ThrottleVerify } from '../throttle/throttle.decorators.js';
import type { Request } from 'express';

/**
 * Public credential verification — no authentication required.
 * Rate-limited to 20 req/min to prevent abuse.
 */
@Controller('public/verify')
export class PublicVerifyController {
  private readonly logger = new Logger(PublicVerifyController.name);

  constructor(private readonly credentialsService: CredentialsService) {}

  @Get(':id')
  @ThrottleVerify()
  async verify(
    @Param('id') id: string,
    @Query('orgName') orgName?: string,
    @Req() req?: Request,
  ) {
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for']?.toString() || 'unknown';
    this.logger.log(`Public verify request for credential ${id} from ${ipAddress}`);
    return this.credentialsService.verify(id, {
      orgName: orgName || 'Public Verification',
      actor: 'public',
      ipAddress,
    });
  }
}
