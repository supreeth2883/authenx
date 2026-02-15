import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditAction } from '@prisma/client';
import * as crypto from 'node:crypto';

interface AuditEntry {
  action: AuditAction;
  credentialId: string;
  organization: string;
  actor?: string;
  result: boolean;
  detail?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate SHA-256 hash of audit entry for chain integrity
   */
  private computeHash(
    previousHash: string,
    action: AuditAction,
    credentialId: string,
    organization: string,
    result: boolean,
    timestamp: Date,
  ): string {
    const payload = JSON.stringify({
      previousHash,
      action,
      credentialId,
      organization,
      result,
      timestamp: timestamp.toISOString(),
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Get the hash of the most recent audit log entry for chain continuation
   */
  private async getLastHash(): Promise<string> {
    const last = await this.prisma.auditLog.findFirst({
      orderBy: { sequence: 'desc' },
      select: { currentHash: true },
    });
    // Genesis block uses zero hash
    return last?.currentHash ?? '0'.repeat(64);
  }

  /**
   * Log an audit event with hash chaining for tamper evidence
   */
  async log(entry: AuditEntry): Promise<void> {
    const timestamp = new Date();
    const previousHash = await this.getLastHash();
    const currentHash = this.computeHash(
      previousHash,
      entry.action,
      entry.credentialId,
      entry.organization,
      entry.result,
      timestamp,
    );

    await this.prisma.auditLog.create({
      data: {
        action: entry.action,
        credentialId: entry.credentialId,
        organization: entry.organization,
        actor: entry.actor,
        result: entry.result,
        detail: entry.detail,
        ipAddress: entry.ipAddress,
        previousHash,
        currentHash,
        createdAt: timestamp,
      },
    });

    this.logger.debug(
      `Audit: ${entry.action} | ${entry.credentialId} | ${entry.organization} | result=${entry.result}`,
    );
  }

  /**
   * Verify the integrity of the audit chain
   * Returns { valid: boolean, brokenAt?: number }
   */
  async verifyChain(): Promise<{ valid: boolean; brokenAt?: number }> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { sequence: 'asc' },
      select: {
        sequence: true,
        action: true,
        credentialId: true,
        organization: true,
        result: true,
        createdAt: true,
        previousHash: true,
        currentHash: true,
      },
    });

    let expectedPreviousHash = '0'.repeat(64);

    for (const log of logs) {
      // Verify previous hash link
      if (log.previousHash !== expectedPreviousHash) {
        return { valid: false, brokenAt: log.sequence };
      }

      // Recompute hash and verify
      const recomputed = this.computeHash(
        log.previousHash,
        log.action,
        log.credentialId,
        log.organization,
        log.result,
        log.createdAt,
      );

      if (recomputed !== log.currentHash) {
        return { valid: false, brokenAt: log.sequence };
      }

      expectedPreviousHash = log.currentHash;
    }

    return { valid: true };
  }
}
