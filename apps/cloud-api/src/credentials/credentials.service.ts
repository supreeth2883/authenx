import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssuersService } from '../issuers/issuers.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction, CredentialStatus } from '@prisma/client';
import * as crypto from 'node:crypto';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

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

  /**
   * Revoke a credential. Only the issuer that created it can revoke.
   */
  async revoke(id: string, opts: { issuerCode: string; reason: string; actor?: string; ipAddress?: string }) {
    const credential = await this.prisma.credential.findUnique({ where: { id } });
    if (!credential) {
      throw new HttpException('Credential not found', HttpStatus.NOT_FOUND);
    }

    if (credential.issuerCode !== opts.issuerCode) {
      throw new HttpException(
        'You can only revoke credentials issued by your institution',
        HttpStatus.FORBIDDEN,
      );
    }

    if (credential.status === CredentialStatus.REVOKED) {
      throw new HttpException('Credential is already revoked', HttpStatus.CONFLICT);
    }

    const updated = await this.prisma.credential.update({
      where: { id },
      data: {
        status: CredentialStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: opts.reason,
      },
    });

    await this.auditService.log({
      action: AuditAction.CREDENTIAL_REVOKED,
      credentialId: id,
      organization: opts.issuerCode,
      actor: opts.actor,
      result: true,
      detail: `Revoked: ${opts.reason}`,
      ipAddress: opts.ipAddress,
    });

    this.logger.log(`Credential revoked: ${id} by ${opts.issuerCode} — ${opts.reason}`);

    return {
      credentialId: updated.id,
      status: updated.status,
      revokedAt: updated.revokedAt,
      revokedReason: updated.revokedReason,
    };
  }

  /**
   * Paginated credential list, optionally scoped by issuerCode.
   */
  async findAll(opts: {
    issuerCode?: string;
    search?: string;
    branch?: string;
    graduationYear?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(opts.page ?? 1, 1);
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    const conditions: any[] = [];

    if (opts.issuerCode) {
      conditions.push({ issuerCode: opts.issuerCode });
    }

    if (opts.search?.trim()) {
      const s = opts.search.trim();
      conditions.push({
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { rollNumber: { contains: s, mode: 'insensitive' } },
        ],
      });
    }

    if (opts.branch?.trim()) {
      conditions.push({ branch: { contains: opts.branch.trim(), mode: 'insensitive' } });
    }

    if (opts.graduationYear) {
      conditions.push({ graduationYear: opts.graduationYear });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.credential.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.credential.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Full cryptographic verification of a credential.
   * Rebuilds canonical JSON → SHA-256 hash check → Ed25519 signature check.
   * Writes verification log + audit log.
   */
  async verify(id: string, opts: { orgName?: string; actor?: string; ipAddress?: string } = {}) {
    const orgName = opts.orgName || 'Unknown';
    const actor = opts.actor || 'public';
    const ipAddress = opts.ipAddress || 'unknown';

    // 1. Fetch credential
    const credential = await this.prisma.credential.findUnique({ where: { id } });
    if (!credential) {
      await this.prisma.verificationLog.create({
        data: { credentialId: id, orgName, result: false, hashValid: false, signatureValid: false },
      });
      await this.auditService.log({
        action: AuditAction.CREDENTIAL_VERIFIED,
        credentialId: id,
        organization: orgName,
        actor,
        result: false,
        detail: 'Credential not found',
        ipAddress,
      });
      throw new HttpException('Credential not found', HttpStatus.NOT_FOUND);
    }

    // 2. Look up issuer + versioned key
    const issuer = await this.issuersService.findByCode(credential.issuerCode);
    if (!issuer) {
      throw new HttpException(`Issuer "${credential.issuerCode}" not found`, HttpStatus.NOT_FOUND);
    }

    const keyVersion = credential.keyVersion ?? 1;
    let publicKeyBase64: string;

    const issuerKey = await this.prisma.issuerKey.findUnique({
      where: { issuerCode_keyVersion: { issuerCode: credential.issuerCode, keyVersion } },
    });

    if (issuerKey) {
      publicKeyBase64 = issuerKey.publicKey;
    } else {
      publicKeyBase64 = issuer.publicKeyEd25519;
    }

    // 3. Rebuild canonical JSON
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

    // 4. SHA-256 hash check
    const recomputedHash = crypto.createHash('sha256').update(canonicalJson).digest('hex');
    const hashValid = recomputedHash === credential.hash;

    // 5. Ed25519 signature check
    const publicKeyBytes = naclUtil.decodeBase64(publicKeyBase64);
    const messageBytes = naclUtil.decodeUTF8(canonicalJson);
    const signatureBytes = naclUtil.decodeBase64(credential.signature);
    const signatureValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    const verified = hashValid && signatureValid;

    // Check revocation status
    const revoked = credential.status === CredentialStatus.REVOKED;

    this.logger.log(`Verify credential ${id}: hash=${hashValid}, sig=${signatureValid}, revoked=${revoked}, keyVersion=${keyVersion}`);

    // 6. Verification log
    await this.prisma.verificationLog.create({
      data: { credentialId: id, orgName, result: verified, hashValid, signatureValid },
    });

    // 7. Audit log
    await this.auditService.log({
      action: AuditAction.CREDENTIAL_VERIFIED,
      credentialId: id,
      organization: orgName,
      actor,
      result: verified,
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
      status: credential.status,
      revokedAt: credential.revokedAt,
      revokedReason: credential.revokedReason,
      verification: {
        hashValid,
        signatureValid,
        verified: verified && !revoked,
        revoked,
        tamperDetected: !hashValid,
        verifiedAt: new Date().toISOString(),
        orgName,
        keyVersion,
      },
    };
  }
}
