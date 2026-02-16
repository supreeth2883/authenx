import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
export class ErpService implements OnModuleInit {
  private readonly logger = new Logger(ErpService.name);

  /** Persistent store lives in .data/ so Render persistent-disk survives redeploys */
  private readonly dataDir = path.join(process.cwd(), '.data');
  private readonly persistPath = path.join(this.dataDir, 'erp_records.json');
  /** Legacy seed file shipped with the repo */
  private readonly legacySeedPath = path.join(process.cwd(), 'data', 'mock_erp.json');

  private readonly cloudApiUrl = process.env.CLOUD_API_URL ?? 'http://localhost:3001';
  private readonly issuerCode = process.env.ISSUER_CODE ?? 'CVR';

  /** In-memory cache — source of truth is the persisted file */
  private students: Student[] = [];

  onModuleInit() {
    this.loadStudents();
  }

  /* ── Persistence helpers ─────────────────────────────────── */

  private loadStudents(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Try persistent store first
    if (fs.existsSync(this.persistPath)) {
      this.students = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
      this.logger.log(`Loaded ${this.students.length} ERP records from ${this.persistPath}`);
      return;
    }

    // Fall back to legacy seed file (first deploy)
    if (fs.existsSync(this.legacySeedPath)) {
      this.students = JSON.parse(fs.readFileSync(this.legacySeedPath, 'utf-8'));
      this.saveStudents(); // persist so future restarts use .data/
      this.logger.log(`Migrated ${this.students.length} ERP records from legacy seed`);
      return;
    }

    // Empty store
    this.students = [];
    this.saveStudents();
    this.logger.warn('No ERP records found — store is empty. Use admin API to seed.');
  }

  private saveStudents(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    fs.writeFileSync(this.persistPath, JSON.stringify(this.students, null, 2));
  }

  /* ── Admin CRUD (mock ERP management) ────────────────────── */

  listStudents(): { count: number; records: Student[] } {
    return { count: this.students.length, records: this.students };
  }

  upsertStudent(record: Student): { action: 'created' | 'updated'; record: Student } {
    const idx = this.students.findIndex(
      (s) => s.rollNumber.trim().toLowerCase() === record.rollNumber.trim().toLowerCase(),
    );
    const canonical: Student = {
      name: record.name.trim(),
      rollNumber: record.rollNumber.trim(),
      degree: record.degree.trim(),
      branch: record.branch.trim(),
      graduationYear: record.graduationYear,
      cgpa: record.cgpa,
    };

    if (idx >= 0) {
      this.students[idx] = canonical;
      this.saveStudents();
      return { action: 'updated', record: canonical };
    }

    this.students.push(canonical);
    this.saveStudents();
    return { action: 'created', record: canonical };
  }

  upsertBatch(records: Student[]): { created: number; updated: number; total: number } {
    let created = 0;
    let updated = 0;
    for (const r of records) {
      const result = this.upsertStudent(r);
      if (result.action === 'created') created++;
      else updated++;
    }
    return { created, updated, total: this.students.length };
  }

  deleteStudent(rollNumber: string): boolean {
    const idx = this.students.findIndex(
      (s) => s.rollNumber.trim().toLowerCase() === rollNumber.trim().toLowerCase(),
    );
    if (idx < 0) return false;
    this.students.splice(idx, 1);
    this.saveStudents();
    return true;
  }

  lookupStudent(rollNumber: string): Student | null {
    return (
      this.students.find(
        (s) => s.rollNumber.trim().toLowerCase() === rollNumber.trim().toLowerCase(),
      ) ?? null
    );
  }

  /* ── Publish flow (connector → cloud-api) ────────────────── */

  async publishResults() {
    if (this.students.length === 0) {
      throw new Error('No ERP records loaded — use admin API to seed records first.');
    }

    this.logger.log(`Publishing ${this.students.length} students from mock ERP`);

    // 2. Issue credentials one by one
    const results: IssueResult[] = [];
    const credentialIds: string[] = [];
    let issued = 0;
    let failed = 0;

    for (const student of this.students) {
      try {
        const res = await fetch(`${this.cloudApiUrl}/credentials/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issuerCode: this.issuerCode,
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

    return {
      total: this.students.length,
      issued,
      failed,
      credentialIds,
      details: results,
    };
  }

  /**
   * Validate a student record against the mock ERP database.
   * Returns { matched: true, student } if all fields match,
   * or { matched: false, reason, diff } if not found or mismatched.
   */
  validateStudent(input: {
    issuerCode: string;
    rollNumber: string;
    name: string;
    degree: string;
    branch: string;
    graduationYear: number;
    cgpa: number;
  }): {
    matched: boolean;
    student?: Student;
    reason?: string;
    diff?: Record<string, { expected: unknown; received: unknown }>;
  } {
    if (this.students.length === 0) {
      return { matched: false, reason: 'ERP_EMPTY' };
    }

    const found = this.students.find(
      (s) => s.rollNumber.trim().toLowerCase() === input.rollNumber.trim().toLowerCase(),
    );

    if (!found) {
      return { matched: false, reason: 'NOT_FOUND' };
    }

    // Strict field comparison (case-insensitive for strings, numeric for numbers)
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

    // Return canonical student data from the ERP (source of truth)
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
