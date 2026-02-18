import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface Student {
  name: string;
  rollNumber: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
}

export interface IssueResult {
  rollNumber: string;
  credentialId?: string;
  error?: string;
}

@Injectable()
export class ErpService {
  private readonly logger = new Logger(ErpService.name);
  private readonly cloudApiUrl = process.env.CLOUD_API_URL ?? 'http://localhost:3001';
  private readonly defaultIssuerCode = process.env.ISSUER_CODE ?? 'TEST-COLLEGE';

  constructor(private readonly prisma: PrismaService) {}

  /* ── Admin CRUD (Postgres-backed) ────────────────────────── */

  async listStudents(issuerCode?: string): Promise<{ count: number; records: Student[] }> {
    const where = issuerCode ? { issuerCode } : { issuerCode: this.defaultIssuerCode };
    const rows = await this.prisma.erpStudent.findMany({ where, orderBy: { rollNumber: 'asc' } });
    const records: Student[] = rows.map((r) => ({
      name: r.name,
      rollNumber: r.rollNumber,
      degree: r.degree,
      branch: r.branch,
      graduationYear: r.graduationYear,
      cgpa: r.cgpa,
    }));
    return { count: records.length, records };
  }

  async lookupStudent(rollNumber: string, issuerCode?: string): Promise<Student | null> {
    const code = issuerCode || this.defaultIssuerCode;
    const row = await this.prisma.erpStudent.findFirst({
      where: { rollNumber: { equals: rollNumber, mode: 'insensitive' }, issuerCode: code },
    });
    if (!row) return null;
    return {
      name: row.name,
      rollNumber: row.rollNumber,
      degree: row.degree,
      branch: row.branch,
      graduationYear: row.graduationYear,
      cgpa: row.cgpa,
    };
  }

  async upsertStudent(
    record: Student,
    issuerCode?: string,
  ): Promise<{ action: 'created' | 'updated'; record: Student }> {
    const code = issuerCode || this.defaultIssuerCode;
    const existing = await this.prisma.erpStudent.findUnique({
      where: { issuerCode_rollNumber: { issuerCode: code, rollNumber: record.rollNumber.trim() } },
    });
    const data = {
      name: record.name.trim(),
      rollNumber: record.rollNumber.trim(),
      degree: record.degree.trim(),
      branch: record.branch.trim(),
      graduationYear: record.graduationYear,
      cgpa: record.cgpa,
      issuerCode: code,
    };
    if (existing) {
      await this.prisma.erpStudent.update({ where: { id: existing.id }, data });
      return { action: 'updated', record: data };
    }
    await this.prisma.erpStudent.create({ data });
    return { action: 'created', record: data };
  }

  async upsertBatch(
    records: Student[],
    issuerCode?: string,
  ): Promise<{ created: number; updated: number; total: number }> {
    let created = 0;
    let updated = 0;
    for (const r of records) {
      const result = await this.upsertStudent(r, issuerCode);
      if (result.action === 'created') created++;
      else updated++;
    }
    const code = issuerCode || this.defaultIssuerCode;
    const total = await this.prisma.erpStudent.count({ where: { issuerCode: code } });
    return { created, updated, total };
  }

  async deleteStudent(rollNumber: string, issuerCode?: string): Promise<boolean> {
    const code = issuerCode || this.defaultIssuerCode;
    const existing = await this.prisma.erpStudent.findFirst({
      where: { rollNumber: { equals: rollNumber, mode: 'insensitive' }, issuerCode: code },
    });
    if (!existing) return false;
    await this.prisma.erpStudent.delete({ where: { id: existing.id } });
    return true;
  }

  /* ── Publish flow (connector → cloud-api) ────────────────── */

  async publishResults() {
    const rows = await this.prisma.erpStudent.findMany({
      where: { issuerCode: this.defaultIssuerCode },
    });
    if (rows.length === 0) {
      throw new Error('No ERP records found. Seed the database first.');
    }

    this.logger.log(`Publishing ${rows.length} students from ERP database`);

    const results: IssueResult[] = [];
    const credentialIds: string[] = [];
    let issued = 0;
    let failed = 0;

    for (const student of rows) {
      try {
        const res = await fetch(`${this.cloudApiUrl}/credentials/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issuerCode: student.issuerCode,
            name: student.name,
            rollNumber: student.rollNumber,
            degree: student.degree,
            branch: student.branch,
            graduationYear: student.graduationYear,
            cgpa: student.cgpa,
          }),
        });

        const body = (await res.json()) as Record<string, unknown>;

        if (!res.ok) {
          const msg = (body.message as string) ?? `HTTP ${res.status}`;
          this.logger.warn(`Failed to issue for ${student.rollNumber}: ${msg}`);
          results.push({ rollNumber: student.rollNumber, error: msg });
          failed++;
          continue;
        }

        const credentialId = body.credentialId as string;
        this.logger.log(`Issued credential ${credentialId} for ${student.rollNumber}`);
        results.push({ rollNumber: student.rollNumber, credentialId });
        credentialIds.push(credentialId);
        issued++;
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.error(`Error issuing for ${student.rollNumber}: ${msg}`);
        results.push({ rollNumber: student.rollNumber, error: msg });
        failed++;
      }
    }

    return { total: rows.length, issued, failed, credentialIds, details: results };
  }

  /* ── Validate student against ERP (used by Model A issue) ── */

  async validateStudent(input: {
    issuerCode: string;
    rollNumber: string;
    name: string;
    degree: string;
    branch: string;
    graduationYear: number;
    cgpa: number;
  }): Promise<{
    matched: boolean;
    student?: Student;
    reason?: string;
    diff?: Record<string, { expected: unknown; received: unknown }>;
  }> {
    const code = input.issuerCode || this.defaultIssuerCode;
    const count = await this.prisma.erpStudent.count({ where: { issuerCode: code } });
    if (count === 0) {
      return { matched: false, reason: 'ERP_EMPTY' };
    }

    const found = await this.prisma.erpStudent.findFirst({
      where: { rollNumber: { equals: input.rollNumber, mode: 'insensitive' }, issuerCode: code },
    });

    if (!found) {
      return { matched: false, reason: 'NOT_FOUND' };
    }

    const diff: Record<string, { expected: unknown; received: unknown }> = {};

    if (found.name.trim().toLowerCase() !== input.name.trim().toLowerCase()) {
      diff.name = { expected: found.name, received: input.name };
    }
    if (found.degree.trim().toLowerCase() !== input.degree.trim().toLowerCase()) {
      diff.degree = { expected: found.degree, received: input.degree };
    }
    if (found.branch.trim().toLowerCase() !== input.branch.trim().toLowerCase()) {
      diff.branch = { expected: found.branch, received: input.branch };
    }
    if (found.graduationYear !== input.graduationYear) {
      diff.graduationYear = { expected: found.graduationYear, received: input.graduationYear };
    }
    if (Math.abs(found.cgpa - input.cgpa) > 0.001) {
      diff.cgpa = { expected: found.cgpa, received: input.cgpa };
    }

    if (Object.keys(diff).length > 0) {
      return { matched: false, reason: 'FIELD_MISMATCH', diff };
    }

    return {
      matched: true,
      student: {
        name: found.name,
        rollNumber: found.rollNumber,
        degree: found.degree,
        branch: found.branch,
        graduationYear: found.graduationYear,
        cgpa: found.cgpa,
      },
    };
  }
}
