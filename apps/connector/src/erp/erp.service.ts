import { Injectable, Logger } from '@nestjs/common';
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
export class ErpService {
  private readonly logger = new Logger(ErpService.name);
  private readonly erpDataPath = path.join(process.cwd(), 'data', 'mock_erp.json');
  private readonly cloudApiUrl = process.env.CLOUD_API_URL ?? 'http://localhost:3001';
  private readonly issuerCode = process.env.ISSUER_CODE ?? 'CVR';

  async publishResults() {
    // 1. Read mock ERP data
    if (!fs.existsSync(this.erpDataPath)) {
      throw new Error(`Mock ERP data not found at ${this.erpDataPath}`);
    }

    const students: Student[] = JSON.parse(
      fs.readFileSync(this.erpDataPath, 'utf-8'),
    );
    this.logger.log(`Read ${students.length} students from mock ERP`);

    // 2. Issue credentials one by one
    const results: IssueResult[] = [];
    const credentialIds: string[] = [];
    let issued = 0;
    let failed = 0;

    for (const student of students) {
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
      total: students.length,
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
    if (!fs.existsSync(this.erpDataPath)) {
      return { matched: false, reason: 'ERP_DATA_NOT_FOUND' };
    }

    const students: Student[] = JSON.parse(
      fs.readFileSync(this.erpDataPath, 'utf-8'),
    );

    const found = students.find(
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
