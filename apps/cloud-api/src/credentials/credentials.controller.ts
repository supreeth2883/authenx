import { Controller, Post, Get, Param, Body, Query, Logger, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { CredentialsService } from './credentials.service.js';
import { IssuersService } from '../issuers/issuers.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UserRole, AuditAction } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ThrottleVerify } from '../throttle/throttle.decorators.js';
import * as crypto from 'node:crypto';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import type { Request } from 'express';

import { IssueCredentialDto } from './dto/issue-credential.dto.js';

@Controller('credentials')
export class CredentialsController {
  private readonly logger = new Logger(CredentialsController.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly issuersService: IssuersService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Post('issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COLLEGE_ADMIN)
  async issue(@Body() body: IssueCredentialDto) {
    return this.credentialsService.issue(body);
  }

  @Get(':id/verify')
  @ThrottleVerify() // 20 req/min - verification tier
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER, UserRole.COLLEGE_ADMIN)
  async verify(
    @Param('id') id: string,
    @Query('orgName') orgName?: string,
    @Req() req?: Request,
  ) {
    const resolvedOrgName = orgName || 'Unknown Employer';
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for']?.toString() || 'unknown';
    const actor = (req as any)?.user?.email || 'unknown';

    // 1. Fetch credential from DB
    const credential = await this.credentialsService.findById(id);
    if (!credential) {
      // Log failed lookup
      await this.prisma.verificationLog.create({
        data: {
          credentialId: id,
          orgName: resolvedOrgName,
          result: false,
          hashValid: false,
          signatureValid: false,
        },
      });
      // Audit log for failed verification
      await this.auditService.log({
        action: AuditAction.CREDENTIAL_VERIFIED,
        credentialId: id,
        organization: resolvedOrgName,
        actor,
        result: false,
        detail: 'Credential not found',
        ipAddress,
      });
      throw new HttpException('Credential not found', HttpStatus.NOT_FOUND);
    }

    // 2. Look up issuer to get public key (versioned lookup)
    const issuer = await this.issuersService.findByCode(credential.issuerCode);
    if (!issuer) {
      throw new HttpException(
        `Issuer "${credential.issuerCode}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 2b. Get the correct public key for the credential's keyVersion
    let publicKeyBase64: string;
    const keyVersion = credential.keyVersion ?? 1;

    // Try to get versioned key from IssuerKey table
    const issuerKey = await this.prisma.issuerKey.findUnique({
      where: {
        issuerCode_keyVersion: {
          issuerCode: credential.issuerCode,
          keyVersion,
        },
      },
    });

    if (issuerKey) {
      publicKeyBase64 = issuerKey.publicKey;
      this.logger.debug(`Using IssuerKey v${keyVersion} for ${credential.issuerCode}`);
    } else {
      // Fallback to legacy publicKeyEd25519 on Issuer (for older credentials)
      publicKeyBase64 = issuer.publicKeyEd25519;
      this.logger.debug(`Fallback to legacy key for ${credential.issuerCode}`);
    }

    // 3. Rebuild canonical JSON (same sorted-key order as issuance)
    const credentialPayload = {
      branch: credential.branch,
      cgpa: credential.cgpa,
      degree: credential.degree,
      graduationYear: credential.graduationYear,
      issuerCode: credential.issuerCode,
      name: credential.name,
      rollNumber: credential.rollNumber,
    };
    const canonicalJson = JSON.stringify(credentialPayload);

    // 4. Verify SHA-256 hash
    const recomputedHash = crypto
      .createHash('sha256')
      .update(canonicalJson)
      .digest('hex');

    const hashValid = recomputedHash === credential.hash;

    // 5. Verify Ed25519 signature with versioned key
    const publicKeyBytes = naclUtil.decodeBase64(publicKeyBase64);
    const messageBytes = naclUtil.decodeUTF8(canonicalJson);
    const signatureBytes = naclUtil.decodeBase64(credential.signature);

    const signatureValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );

    this.logger.log(
      `Verify credential ${id}: hash=${hashValid}, sig=${signatureValid}, keyVersion=${keyVersion}`,
    );

    // 6. Write verification log
    await this.prisma.verificationLog.create({
      data: {
        credentialId: id,
        orgName: resolvedOrgName,
        result: hashValid && signatureValid,
        hashValid,
        signatureValid,
      },
    });

    // 7. Audit log for verification
    await this.auditService.log({
      action: AuditAction.CREDENTIAL_VERIFIED,
      credentialId: id,
      organization: resolvedOrgName,
      actor,
      result: hashValid && signatureValid,
      detail: `hash=${hashValid}, sig=${signatureValid}`,
      ipAddress,
    });

    return {
      credentialId: credential.id,
      issuerCode: credential.issuerCode,
      keyVersion,
      name: credential.name,
      rollNumber: credential.rollNumber,
      degree: credential.degree,
      branch: credential.branch,
      graduationYear: credential.graduationYear,
      cgpa: credential.cgpa,
      issuedAt: credential.createdAt,
      verification: {
        hashValid,
        signatureValid,
        verified: hashValid && signatureValid,
        verifiedAt: new Date().toISOString(),
        orgName: resolvedOrgName,
        keyVersion,
      },
    };
  }
}
