import {
  Controller,
  Post,
  Body,
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
          results.push({
            rollNumber: record.rollNumber,
            status: validationResult.reason === 'NOT_FOUND' ? 'NOT_FOUND' : 'MISMATCH',
            reason: validationResult.reason,
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
          results.push({
            rollNumber: record.rollNumber,
            status: 'ALREADY_ISSUED',
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
