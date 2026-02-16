import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssuersService } from '../issuers/issuers.service.js';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import * as crypto from 'node:crypto';

@Controller('admin/issuers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminIssuersController {
  private readonly logger = new Logger(AdminIssuersController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly issuersService: IssuersService,
  ) {}

  /**
   * GET /admin/issuers — list all registered issuers (safe fields only)
   */
  @Get()
  async list() {
    const issuers = await this.prisma.issuer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { org: { select: { name: true, status: true } } },
    });

    return issuers.map((i) => ({
      id: i.id,
      issuerCode: i.issuerCode,
      name: i.org?.name ?? i.issuerCode,
      connectorBaseUrl: i.connectorBaseUrl,
      publicKeyFingerprint: crypto
        .createHash('sha256')
        .update(i.publicKeyEd25519)
        .digest('hex')
        .slice(0, 16),
      orgStatus: i.org?.status ?? 'UNKNOWN',
      createdAt: i.createdAt,
    }));
  }

  /**
   * POST /admin/issuers/register — register a new issuer
   * Wraps existing IssuersService.register()
   */
  @Post('register')
  async register(
    @Body() body: { issuerCode?: string; name?: string; connectorBaseUrl?: string },
  ) {
    const { issuerCode, name, connectorBaseUrl } = body;

    if (!issuerCode?.trim()) {
      throw new HttpException('issuerCode is required', HttpStatus.BAD_REQUEST);
    }
    if (!name?.trim()) {
      throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
    }
    if (!connectorBaseUrl?.trim()) {
      throw new HttpException('connectorBaseUrl is required', HttpStatus.BAD_REQUEST);
    }

    // Validate URL format
    try {
      new URL(connectorBaseUrl);
    } catch {
      throw new HttpException(
        'connectorBaseUrl must be a valid URL (e.g. https://authenx-connector.onrender.com)',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Delegate to existing service (handles 409, 502, etc.)
    const result = await this.issuersService.register({
      issuerCode: issuerCode.trim(),
      name: name.trim(),
      connectorBaseUrl: connectorBaseUrl.trim().replace(/\/+$/, ''),
    });

    // Return safe subset (omit connectorApiKey for UI — not needed for proxy architecture)
    return {
      issuerCode: result.issuerCode,
      orgId: result.orgId,
      publicKeyEd25519: result.publicKeyEd25519,
      message: result.message,
    };
  }

  /**
   * POST /admin/issuers/check-connector — health-check a connector URL
   * Does NOT require issuer to be registered yet — useful for pre-registration validation.
   */
  @Post('check-connector')
  async checkConnector(
    @Body() body: { connectorBaseUrl?: string },
  ) {
    const url = body.connectorBaseUrl?.trim()?.replace(/\/+$/, '');
    if (!url) {
      throw new HttpException('connectorBaseUrl is required', HttpStatus.BAD_REQUEST);
    }

    const checks: {
      health: { ok: boolean; status: number | null; latencyMs: number; message: string };
      publicKey: { ok: boolean; issuerCode: string | null; fingerprint: string | null; message: string };
    } = {
      health: { ok: false, status: null, latencyMs: 0, message: '' },
      publicKey: { ok: false, issuerCode: null, fingerprint: null, message: '' },
    };

    // 1. Health check: GET /
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      checks.health = {
        ok: res.ok,
        status: res.status,
        latencyMs: Date.now() - t0,
        message: res.ok ? 'Connector is reachable' : `Unexpected status ${res.status}`,
      };
    } catch (err) {
      checks.health = {
        ok: false,
        status: null,
        latencyMs: Date.now() - t0,
        message: `Unreachable: ${(err as Error).message}`,
      };
    }

    // 2. Public key probe: GET /public-key
    try {
      const res = await fetch(`${url}/public-key`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { issuerCode?: string; publicKeyEd25519?: string };
        const fingerprint = data.publicKeyEd25519
          ? crypto.createHash('sha256').update(data.publicKeyEd25519).digest('hex').slice(0, 16)
          : null;
        checks.publicKey = {
          ok: true,
          issuerCode: data.issuerCode ?? null,
          fingerprint,
          message: 'Public key fetched successfully',
        };
      } else {
        checks.publicKey.message = `HTTP ${res.status}`;
      }
    } catch (err) {
      checks.publicKey.message = `Failed: ${(err as Error).message}`;
    }

    return checks;
  }

  /**
   * POST /admin/issuers/:issuerCode/ping — ping a registered connector
   */
  @Post(':issuerCode/ping')
  async pingConnector(@Param('issuerCode') issuerCode: string) {
    const issuer = await this.prisma.issuer.findUnique({ where: { issuerCode } });
    if (!issuer) {
      throw new HttpException(`Issuer "${issuerCode}" not found`, HttpStatus.NOT_FOUND);
    }

    const t0 = Date.now();
    try {
      const res = await fetch(issuer.connectorBaseUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      return {
        ok: res.ok,
        status: res.status,
        latencyMs: Date.now() - t0,
        message: res.ok ? 'Connector is reachable' : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        status: null,
        latencyMs: Date.now() - t0,
        message: `Unreachable: ${(err as Error).message}`,
      };
    }
  }

  /**
   * GET /admin/issuers/:issuerCode/erp/records — list mock ERP records via connector
   * Proxies to connector GET /erp/admin/records (requires CONNECTOR_ADMIN_KEY)
   */
  @Get(':issuerCode/erp/records')
  async listErpRecords(@Param('issuerCode') issuerCode: string) {
    const issuer = await this.prisma.issuer.findUnique({ where: { issuerCode } });
    if (!issuer) {
      throw new HttpException(`Issuer "${issuerCode}" not found`, HttpStatus.NOT_FOUND);
    }

    const adminKey = process.env.CONNECTOR_ADMIN_KEY;
    if (!adminKey) {
      throw new HttpException('CONNECTOR_ADMIN_KEY not configured on cloud-api', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const res = await fetch(`${issuer.connectorBaseUrl}/erp/admin/records`, {
        headers: { Authorization: `Bearer ${adminKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Connector returned HTTP ${res.status}: ${body}`);
      }
      return await res.json();
    } catch (err) {
      throw new HttpException(
        `Failed to fetch ERP records: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * POST /admin/issuers/:issuerCode/erp/upsert-batch — seed mock ERP records
   * Proxies to connector POST /erp/admin/upsert-batch
   */
  @Post(':issuerCode/erp/upsert-batch')
  async seedErpRecords(
    @Param('issuerCode') issuerCode: string,
    @Body() body: { records?: Array<{ rollNumber: string; name: string; degree?: string; branch?: string; graduationYear?: number; cgpa?: number }> },
  ) {
    const issuer = await this.prisma.issuer.findUnique({ where: { issuerCode } });
    if (!issuer) {
      throw new HttpException(`Issuer "${issuerCode}" not found`, HttpStatus.NOT_FOUND);
    }

    if (!Array.isArray(body?.records) || body.records.length === 0) {
      throw new HttpException('records array is required', HttpStatus.BAD_REQUEST);
    }

    const adminKey = process.env.CONNECTOR_ADMIN_KEY;
    if (!adminKey) {
      throw new HttpException('CONNECTOR_ADMIN_KEY not configured on cloud-api', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const res = await fetch(`${issuer.connectorBaseUrl}/erp/admin/upsert-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ records: body.records }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Connector returned HTTP ${res.status}: ${errBody}`);
      }
      return await res.json();
    } catch (err) {
      throw new HttpException(
        `Failed to seed ERP records: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
