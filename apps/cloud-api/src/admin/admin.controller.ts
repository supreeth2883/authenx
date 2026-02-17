import { Controller, Get, Param, Query, Logger, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { Request } from 'express';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get('logs')
  async getLogs(@Query('limit') limitStr?: string) {
    const limit = Math.min(Math.max(parseInt(limitStr || '10', 10) || 10, 1), 100);

    const logs = await this.prisma.verificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    this.logger.log(`Returning ${logs.length} verification logs`);
    return logs;
  }

  @Get('stats')
  async getStats(@Req() req: Request) {
    const user = (req as any).user;
    const issuerScope = user?.role === UserRole.COLLEGE_ADMIN && user?.issuerCode
      ? { issuerCode: user.issuerCode } : {};
    const credWhere: Prisma.CredentialWhereInput = issuerScope;
    // Verification logs reference credentialId; scope via credential lookup
    const credIds = Object.keys(issuerScope).length > 0
      ? (await this.prisma.credential.findMany({ where: credWhere, select: { id: true } })).map(c => c.id)
      : null;
    const verWhere: Prisma.VerificationLogWhereInput = credIds ? { credentialId: { in: credIds } } : {};

    const [totalCredentials, totalVerifications, successCount, failedCount] =
      await Promise.all([
        this.prisma.credential.count({ where: credWhere }),
        this.prisma.verificationLog.count({ where: verWhere }),
        this.prisma.verificationLog.count({ where: { ...verWhere, result: true } }),
        this.prisma.verificationLog.count({ where: { ...verWhere, result: false } }),
      ]);

    return { totalCredentials, totalVerifications, successCount, failedCount };
  }

  @Get('credentials')
  async getCredentials(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('branch') branch?: string,
    @Query('graduationYear') graduationYearStr?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const user = (req as any).user;
    const page = Math.max(parseInt(pageStr || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.CredentialWhereInput = {};
    const conditions: Prisma.CredentialWhereInput[] = [];

    // Scope to issuerCode for COLLEGE_ADMIN
    if (user?.role === UserRole.COLLEGE_ADMIN && user?.issuerCode) {
      conditions.push({ issuerCode: user.issuerCode });
    }

    if (search?.trim()) {
      const s = search.trim();
      conditions.push({
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { rollNumber: { contains: s, mode: 'insensitive' } },
        ],
      });
    }

    if (branch?.trim()) {
      conditions.push({ branch: { contains: branch.trim(), mode: 'insensitive' } });
    }

    const graduationYear = parseInt(graduationYearStr || '', 10);
    if (!isNaN(graduationYear)) {
      conditions.push({ graduationYear });
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

  @Get('credentials/:id')
  async getCredentialById(@Param('id') id: string) {
    const credential = await this.prisma.credential.findUnique({ where: { id } });
    if (!credential) {
      throw new HttpException('Credential not found', HttpStatus.NOT_FOUND);
    }
    return credential;
  }

  @Get('analytics')
  async getAnalytics(@Req() req: Request) {
    const user = (req as any).user;
    const issuerScope = user?.role === UserRole.COLLEGE_ADMIN && user?.issuerCode
      ? { issuerCode: user.issuerCode } : {};

    // Issued per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const issuedRaw = await this.prisma.credential.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, ...issuerScope },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const issuedMap = new Map<string, number>();
    for (const c of issuedRaw) {
      const day = c.createdAt.toISOString().split('T')[0];
      issuedMap.set(day, (issuedMap.get(day) || 0) + 1);
    }
    const issuedPerDay = Array.from(issuedMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    // Verification rate
    const totalVerifications = await this.prisma.verificationLog.count();
    const successCount = await this.prisma.verificationLog.count({
      where: { result: true },
    });
    const verificationRate =
      totalVerifications > 0
        ? Math.round((successCount / totalVerifications) * 10000) / 100
        : 0;

    // Top organizations
    const topOrgsRaw = await this.prisma.verificationLog.groupBy({
      by: ['orgName'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const topOrganizations = topOrgsRaw.map((o) => ({
      orgName: o.orgName,
      count: o._count.id,
    }));

    return { issuedPerDay, verificationRate, topOrganizations };
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('organization') organization?: string,
    @Query('credentialId') credentialId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(parseInt(pageStr || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 500);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    const conditions: Prisma.AuditLogWhereInput[] = [];

    if (action?.trim() && ['CREDENTIAL_ISSUED', 'CREDENTIAL_VERIFIED', 'CREDENTIAL_REVOKED'].includes(action)) {
      conditions.push({ action: action as any });
    }

    if (organization?.trim()) {
      conditions.push({ organization: { contains: organization.trim(), mode: 'insensitive' } });
    }

    if (credentialId?.trim()) {
      conditions.push({ credentialId: { contains: credentialId.trim(), mode: 'insensitive' } });
    }

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        conditions.push({ createdAt: { gte: start } });
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        conditions.push({ createdAt: { lte: end } });
      }
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { sequence: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('audit-logs/verify-chain')
  async verifyAuditChain() {
    // Verify integrity of the audit chain using proper hash recomputation
    const result = await this.auditService.verifyChain();
    
    // Get total entries for response
    const total = await this.prisma.auditLog.count();
    
    return { 
      valid: result.valid, 
      totalEntries: total, 
      brokenAt: result.brokenAt 
    };
  }

  @Get('audit-logs/export')
  async exportAuditLogs(
    @Query('action') action?: string,
    @Query('organization') organization?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {};
    const conditions: Prisma.AuditLogWhereInput[] = [];

    if (action?.trim() && ['CREDENTIAL_ISSUED', 'CREDENTIAL_VERIFIED', 'CREDENTIAL_REVOKED'].includes(action)) {
      conditions.push({ action: action as any });
    }

    if (organization?.trim()) {
      conditions.push({ organization: { contains: organization.trim(), mode: 'insensitive' } });
    }

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        conditions.push({ createdAt: { gte: start } });
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        conditions.push({ createdAt: { lte: end } });
      }
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { sequence: 'desc' },
      take: 10000, // Max export limit
    });

    // Build CSV
    const headers = ['sequence', 'action', 'credentialId', 'organization', 'actor', 'result', 'detail', 'ipAddress', 'previousHash', 'currentHash', 'createdAt'];
    const rows = logs.map((l) => [
      l.sequence,
      l.action,
      l.credentialId,
      l.organization,
      l.actor || '',
      l.result,
      (l.detail || '').replace(/"/g, '""'),
      l.ipAddress || '',
      l.previousHash,
      l.currentHash,
      l.createdAt.toISOString(),
    ].map((v) => `"${v}"`).join(','));

    return {
      csv: [headers.join(','), ...rows].join('\n'),
      filename: `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
      count: logs.length,
    };
  }
}
