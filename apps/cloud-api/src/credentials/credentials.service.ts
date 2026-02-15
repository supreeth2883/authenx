import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssuersService } from '../issuers/issuers.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '@prisma/client';
import * as crypto from 'node:crypto';

interface IssueCredentialDto {
  issuerCode: string;
  name: string;
  rollNumber: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
}

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly issuersService: IssuersService,
    private readonly auditService: AuditService,
  ) {}

  async issue(dto: IssueCredentialDto) {
    // 1. Look up issuer
    const issuer = await this.issuersService.findByCode(dto.issuerCode);
    if (!issuer) {
      throw new HttpException(
        `Issuer "${dto.issuerCode}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Build canonical JSON (sorted keys, no whitespace)
    const credentialPayload = {
      branch: dto.branch,
      cgpa: dto.cgpa,
      degree: dto.degree,
      graduationYear: dto.graduationYear,
      issuerCode: dto.issuerCode,
      name: dto.name,
      rollNumber: dto.rollNumber,
    };
    const canonicalJson = JSON.stringify(credentialPayload);

    // 3. SHA-256 hash of the canonical JSON
    const hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

    // 4. Check for duplicate
    const existing = await this.prisma.credential.findUnique({
      where: { hash },
    });
    if (existing) {
      throw new HttpException(
        `Credential already issued (id=${existing.id})`,
        HttpStatus.CONFLICT,
      );
    }

    // 5. Call connector POST /sign to get Ed25519 signature
    const signUrl = `${issuer.connectorBaseUrl}/sign`;
    this.logger.log(`Requesting signature from ${signUrl}`);

    let signatureResponse: { signature: string; keyVersion: number };
    try {
      const res = await fetch(signUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: canonicalJson }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      signatureResponse = (await res.json()) as typeof signatureResponse;
    } catch (err) {
      throw new HttpException(
        `Failed to get signature from connector: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // 5b. Sync public key to IssuerKey table if needed
    const keyVersion = signatureResponse.keyVersion ?? 1;
    await this.syncIssuerKey(issuer.issuerCode, issuer.connectorBaseUrl, keyVersion);

    // 6. Store credential in DB with keyVersion
    const credential = await this.prisma.credential.create({
      data: {
        issuerCode: dto.issuerCode,
        keyVersion,
        name: dto.name,
        rollNumber: dto.rollNumber,
        degree: dto.degree,
        branch: dto.branch,
        graduationYear: dto.graduationYear,
        cgpa: dto.cgpa,
        hash,
        signature: signatureResponse.signature,
      },
    });

    // 7. Audit log
    await this.auditService.log({
      action: AuditAction.CREDENTIAL_ISSUED,
      credentialId: credential.id,
      organization: dto.issuerCode,
      result: true,
      detail: `Issued to ${dto.name} (${dto.rollNumber})`,
    });

    this.logger.log(`Credential issued: ${credential.id} (keyVersion=${keyVersion})`);

    return {
      credentialId: credential.id,
      hash,
      signature: signatureResponse.signature,
      keyVersion,
      verifyUrl: `/credentials/${credential.id}/verify`,
    };
  }

  /**
   * Sync the public key from connector to IssuerKey table
   */
  private async syncIssuerKey(issuerCode: string, connectorBaseUrl: string, version: number): Promise<void> {
    const existing = await this.prisma.issuerKey.findUnique({
      where: {
        issuerCode_keyVersion: { issuerCode, keyVersion: version },
      },
    });

    if (existing) return; // Already synced

    // Fetch public key from connector
    const pkUrl = `${connectorBaseUrl}/public-key?version=${version}`;
    this.logger.log(`Syncing public key from ${pkUrl}`);

    try {
      const res = await fetch(pkUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { publicKeyEd25519: string };

      await this.prisma.issuerKey.create({
        data: {
          issuerCode,
          keyVersion: version,
          publicKey: data.publicKeyEd25519,
          active: true,
        },
      });

      this.logger.log(`Synced IssuerKey: ${issuerCode} v${version}`);
    } catch (err) {
      this.logger.warn(`Failed to sync IssuerKey: ${(err as Error).message}`);
    }
  }

  async findById(id: string) {
    return this.prisma.credential.findUnique({ where: { id } });
  }
}
