import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CredentialsService } from './credentials.service.js';
import { IssuersService } from '../issuers/issuers.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import { PublishCredentialsDto, StudentRecordDto } from './dto/publish-credentials.dto.js';
import type { Request } from 'express';

interface PublishResult {
  rollNumber: string;
  status: 'MATCHED_AND_ISSUED' | 'NOT_FOUND' | 'MISMATCH' | 'ALREADY_ISSUED' | 'ERROR';
  credentialId?: string;
  qrPayload?: string;
  reason?: string;
  diff?: Record<string, unknown>;
}

@Controller('college/credentials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COLLEGE_ADMIN)
export class CollegeCredentialsController {
  private readonly logger = new Logger(CollegeCredentialsController.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly issuersService: IssuersService,
  ) {}

  /**
   * GET /college/credentials — paginated list scoped to the user's issuerCode
   */
  @Get()
  async list(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('branch') branch?: string,
    @Query('graduationYear') graduationYearStr?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const user = (req as any).user;
    const issuerCode = user?.issuerCode;
    if (!issuerCode) {
      throw new HttpException(
        'User has no associated issuerCode',
        HttpStatus.FORBIDDEN,
      );
    }

    const page = Math.max(parseInt(pageStr || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 100);
    const graduationYear = parseInt(graduationYearStr || '', 10);

    return this.credentialsService.findAll({
      issuerCode,
      search: search?.trim(),
      branch: branch?.trim(),
      graduationYear: !isNaN(graduationYear) ? graduationYear : undefined,
      page,
      limit,
    });
  }

  /**
   * PATCH /college/credentials/:id/revoke — revoke a credential
   * Only the COLLEGE_ADMIN whose issuerCode matches can revoke.
   */
  @Patch(':id/revoke')
  async revoke(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const issuerCode = user?.issuerCode;
    if (!issuerCode) {
      throw new HttpException(
        'User has no associated issuerCode',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!reason?.trim()) {
      throw new HttpException(
        'Revocation reason is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.credentialsService.revoke(id, {
      issuerCode,
      reason: reason.trim(),
      actor: user.email,
      ipAddress: req.ip || (req.headers as any)?.['x-forwarded-for']?.toString() || 'unknown',
    });
  }

  /**
   * POST /college/credentials/precheck — validate a student against connector ERP
   * Returns { matched, reason, diff } without issuing anything.
   */
  @Post('precheck')
  async precheck(
    @Body() body: { issuerCode: string; rollNumber: string; name: string; degree: string; branch: string; graduationYear: number; cgpa: number },
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const issuerCode = user?.issuerCode;
    if (!issuerCode) {
      throw new HttpException('User has no associated issuerCode', HttpStatus.FORBIDDEN);
    }

    // Use the user's issuerCode, not whatever was passed in body
    const issuer = await this.issuersService.findByCode(issuerCode);
    if (!issuer) {
      throw new HttpException(`Issuer "${issuerCode}" not found`, HttpStatus.NOT_FOUND);
    }

    return this.validateWithConnector(issuer.connectorBaseUrl, issuerCode, {
      rollNumber: body.rollNumber,
      name: body.name,
      degree: body.degree,
      branch: body.branch,
      graduationYear: body.graduationYear,
      cgpa: body.cgpa,
    });
  }

  @Post('publish')
  async publish(
    @Body() dto: PublishCredentialsDto,
    @Req() req: Request,
  ) {
    const actor = (req as any).user?.email ?? 'unknown';
    this.logger.log(
      `[AUDIT] PUBLISH_CREDENTIALS by=${actor} issuer=${dto.issuerCode} count=${dto.records.length}`,
    );

    // 1. Verify issuer exists
    const issuer = await this.issuersService.findByCode(dto.issuerCode);
    if (!issuer) {
      throw new HttpException(
        `Issuer "${dto.issuerCode}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Process each record
    const results: PublishResult[] = [];

    for (const record of dto.records) {
      try {
        // 2a. Validate against connector's ERP
        const validationResult = await this.validateWithConnector(
          issuer.connectorBaseUrl,
          dto.issuerCode,
          record,
        );

        if (!validationResult.matched) {
          const reason = validationResult.reason === 'NOT_FOUND'
            ? 'Student not found in ERP source. Seed mock ERP via Admin → Issuers → Seed ERP, or connect a real ERP.'
            : validationResult.reason === 'ERP_EMPTY'
              ? 'ERP store is empty — no student records loaded. Seed mock ERP first.'
              : validationResult.reason;
          results.push({
            rollNumber: record.rollNumber,
            status: validationResult.reason === 'NOT_FOUND' || validationResult.reason === 'ERP_EMPTY' ? 'NOT_FOUND' : 'MISMATCH',
            reason,
            diff: validationResult.diff,
          });
          continue;
        }

        // 2b. Issue credential using canonical fields from ERP (source of truth)
        const student = validationResult.student!;
        const issued = await this.credentialsService.issue({
          issuerCode: dto.issuerCode,
          name: student.name,
          rollNumber: student.rollNumber,
          degree: student.degree,
          branch: student.branch,
          graduationYear: student.graduationYear,
          cgpa: student.cgpa,
        });

        results.push({
          rollNumber: record.rollNumber,
          status: 'MATCHED_AND_ISSUED',
          credentialId: issued.credentialId,
          qrPayload: `authenx:${issued.credentialId}`,
        });
      } catch (err) {
        const message = (err as any)?.response?.message ?? (err as Error).message;
        // Handle duplicate credential (already issued)
        if ((err as any)?.status === 409) {
          // Extract existing credential ID from the error message
          const match = message.match(/id=([a-zA-Z0-9]+)/);
          const existingId = match ? match[1] : undefined;
          results.push({
            rollNumber: record.rollNumber,
            status: 'ALREADY_ISSUED',
            credentialId: existingId,
            reason: message,
          });
        } else {
          this.logger.error(
            `Error issuing for ${record.rollNumber}: ${message}`,
          );
          results.push({
            rollNumber: record.rollNumber,
            status: 'ERROR',
            reason: message,
          });
        }
      }
    }

    const issued = results.filter((r) => r.status === 'MATCHED_AND_ISSUED').length;
    const failed = results.length - issued;

    this.logger.log(
      `Publish complete: ${issued} issued, ${failed} failed out of ${results.length}`,
    );

    return {
      total: results.length,
      issued,
      failed,
      results,
    };
  }

  /**
   * Call connector POST /erp/validate-student to check record against ERP DB
   */
  private async validateWithConnector(
    connectorBaseUrl: string,
    issuerCode: string,
    record: StudentRecordDto,
  ): Promise<{
    matched: boolean;
    student?: {
      name: string;
      rollNumber: string;
      degree: string;
      branch: string;
      graduationYear: number;
      cgpa: number;
    };
    reason?: string;
    diff?: Record<string, unknown>;
  }> {
    const url = `${connectorBaseUrl}/erp/validate-student`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerCode,
          rollNumber: record.rollNumber,
          name: record.name,
          degree: record.degree,
          branch: record.branch,
          graduationYear: record.graduationYear,
          cgpa: record.cgpa,
        }),
      });

      if (!res.ok) {
        throw new Error(`Connector returned HTTP ${res.status}`);
      }

      return (await res.json()) as Awaited<ReturnType<typeof this.validateWithConnector>>;
    } catch (err) {
      throw new HttpException(
        `Failed to validate with connector: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
