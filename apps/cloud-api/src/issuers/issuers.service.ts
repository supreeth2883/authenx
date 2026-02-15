import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as crypto from 'node:crypto';

interface RegisterIssuerDto {
  issuerCode: string;
  name: string;
  connectorBaseUrl: string;
}

@Injectable()
export class IssuersService {
  private readonly logger = new Logger(IssuersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterIssuerDto) {
    // 1. Check if issuer already exists
    const existing = await this.prisma.issuer.findUnique({
      where: { issuerCode: dto.issuerCode },
    });
    if (existing) {
      throw new HttpException(
        `Issuer "${dto.issuerCode}" already registered`,
        HttpStatus.CONFLICT,
      );
    }

    // 2. Fetch public key from the connector
    const pkUrl = `${dto.connectorBaseUrl}/public-key`;
    this.logger.log(`Fetching public key from ${pkUrl}`);

    let publicKeyResponse: { issuerCode: string; publicKeyEd25519: string };
    try {
      const res = await fetch(pkUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      publicKeyResponse = (await res.json()) as typeof publicKeyResponse;
    } catch (err) {
      throw new HttpException(
        `Failed to fetch public key from connector at ${pkUrl}: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (publicKeyResponse.issuerCode !== dto.issuerCode) {
      throw new HttpException(
        `Connector returned issuerCode "${publicKeyResponse.issuerCode}" but expected "${dto.issuerCode}"`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Generate a connector API key
    const connectorApiKey = crypto.randomBytes(32).toString('hex');
    const connectorApiKeyHash = crypto
      .createHash('sha256')
      .update(connectorApiKey)
      .digest('hex');

    // 4. Create Org + Issuer
    const org = await this.prisma.org.create({
      data: {
        orgType: 'ISSUER',
        name: dto.name,
        status: 'ACTIVE',
        issuer: {
          create: {
            issuerCode: dto.issuerCode,
            publicKeyEd25519: publicKeyResponse.publicKeyEd25519,
            connectorBaseUrl: dto.connectorBaseUrl,
            connectorApiKeyHash,
          },
        },
      },
      include: { issuer: true },
    });

    this.logger.log(`Registered issuer "${dto.issuerCode}" (org=${org.id})`);

    return {
      issuerCode: dto.issuerCode,
      orgId: org.id,
      connectorApiKey, // returned ONCE — save it!
      publicKeyEd25519: publicKeyResponse.publicKeyEd25519,
      message: 'Issuer registered. Save your connectorApiKey — it will not be shown again.',
    };
  }

  async findByCode(issuerCode: string) {
    return this.prisma.issuer.findUnique({ where: { issuerCode } });
  }

  /**
   * Rotate keys for an issuer
   * - Calls connector to generate new keypair
   * - Marks old keys as inactive (but keeps them for verification)
   * - Stores new key in IssuerKey table
   */
  async rotateKey(issuerCode: string) {
    // 1. Find issuer
    const issuer = await this.prisma.issuer.findUnique({
      where: { issuerCode },
    });
    if (!issuer) {
      throw new HttpException(
        `Issuer "${issuerCode}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Ensure v1 key is stored (migrate from connector if needed)
    await this.ensureLegacyKeyMigrated(issuerCode, issuer.connectorBaseUrl);

    // 3. Call connector to rotate key
    const rotateUrl = `${issuer.connectorBaseUrl}/rotate-key`;
    this.logger.log(`Rotating key for ${issuerCode} via ${rotateUrl}`);

    let rotateResponse: { newVersion: number; publicKey: string };
    try {
      const res = await fetch(rotateUrl, { method: 'POST' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      rotateResponse = (await res.json()) as typeof rotateResponse;
    } catch (err) {
      throw new HttpException(
        `Failed to rotate key on connector: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // 4. Mark all existing keys as inactive (NOT revoked - they're still valid for verification)
    await this.prisma.issuerKey.updateMany({
      where: { issuerCode, active: true },
      data: { active: false },
    });

    // 5. Create new IssuerKey record
    const newKey = await this.prisma.issuerKey.create({
      data: {
        issuerCode,
        keyVersion: rotateResponse.newVersion,
        publicKey: rotateResponse.publicKey,
        active: true,
      },
    });

    // 6. Update legacy publicKeyEd25519 on Issuer for compatibility
    await this.prisma.issuer.update({
      where: { issuerCode },
      data: { publicKeyEd25519: rotateResponse.publicKey },
    });

    this.logger.log(`Rotated key for ${issuerCode} to v${rotateResponse.newVersion}`);

    return {
      issuerCode,
      newVersion: rotateResponse.newVersion,
      publicKey: rotateResponse.publicKey,
      message: `Key rotated to version ${rotateResponse.newVersion}. Old credentials remain valid.`,
    };
  }

  /**
   * Migrate legacy key from connector to IssuerKey table
   * Fetches the actual v1 key from connector, not from Issuer table
   */
  private async ensureLegacyKeyMigrated(issuerCode: string, connectorBaseUrl: string): Promise<void> {
    const existingV1 = await this.prisma.issuerKey.findUnique({
      where: {
        issuerCode_keyVersion: { issuerCode, keyVersion: 1 },
      },
    });

    if (!existingV1) {
      // Fetch original v1 key from connector
      try {
        const res = await fetch(`${connectorBaseUrl}/public-key?version=1`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { publicKeyEd25519: string };

        await this.prisma.issuerKey.create({
          data: {
            issuerCode,
            keyVersion: 1,
            publicKey: data.publicKeyEd25519,
            active: false,
          },
        });
        this.logger.log(`Migrated legacy key for ${issuerCode} to IssuerKey v1`);
      } catch (err) {
        this.logger.warn(`Failed to migrate legacy key: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Get all public keys for an issuer (for /.well-known endpoint)
   */
  async getPublicKeys(issuerCode: string) {
    const issuer = await this.prisma.issuer.findUnique({
      where: { issuerCode },
    });
    if (!issuer) {
      throw new HttpException(
        `Issuer "${issuerCode}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const keys = await this.prisma.issuerKey.findMany({
      where: { issuerCode },
      orderBy: { keyVersion: 'desc' },
      select: {
        keyVersion: true,
        publicKey: true,
        active: true,
        createdAt: true,
        revokedAt: true,
      },
    });

    // If no versioned keys yet, return the legacy key as v1
    if (keys.length === 0) {
      return {
        issuerCode,
        keys: [
          {
            keyVersion: 1,
            publicKey: issuer.publicKeyEd25519,
            active: true,
            createdAt: issuer.createdAt,
            revokedAt: null,
          },
        ],
        activeVersion: 1,
      };
    }

    const activeKey = keys.find((k) => k.active);

    return {
      issuerCode,
      keys,
      activeVersion: activeKey?.keyVersion ?? keys[0].keyVersion,
    };
  }
}
