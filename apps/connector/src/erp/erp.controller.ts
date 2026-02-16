import { Controller, Post, Get, Delete, Body, Param, Headers, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ErpService } from './erp.service.js';

interface ValidateStudentBody {
  issuerCode: string;
  rollNumber: string;
  name: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
}

interface UpsertStudentBody {
  rollNumber: string;
  name: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
}

/** Parse MOCK_ERP_ADMIN_MODE — safe default is "disabled" */
function parseErpAdminMode(): 'enabled' | 'disabled' {
  const raw = (process.env.MOCK_ERP_ADMIN_MODE ?? '').trim().toLowerCase();
  return raw === 'enabled' ? 'enabled' : 'disabled';
}

@Controller('erp')
export class ErpController {
  private readonly logger = new Logger(ErpController.name);
  private readonly adminKey = process.env.CONNECTOR_ADMIN_KEY || '';
  private readonly erpAdminMode = parseErpAdminMode();

  constructor(private readonly erpService: ErpService) {
    this.logger.log(`Mock ERP admin mode: ${this.erpAdminMode}`);
  }

  /* ── Guard helper ──────────────────────────────────────────── */

  /**
   * When MOCK_ERP_ADMIN_MODE=disabled (or unset), admin endpoints return 404
   * so attackers cannot discover them. When enabled, require CONNECTOR_ADMIN_KEY.
   */
  private assertAdmin(authHeader?: string): void {
    if (this.erpAdminMode !== 'enabled') {
      // Return 404 — endpoint does not exist in production
      throw new HttpException('Not Found', HttpStatus.NOT_FOUND);
    }
    if (!this.adminKey) {
      throw new HttpException('CONNECTOR_ADMIN_KEY is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const token = authHeader?.replace(/^[Bb]earer\s+/, '').trim();
    if (token !== this.adminKey) {
      throw new HttpException('Invalid admin key', HttpStatus.UNAUTHORIZED);
    }
  }

  /* ── Status endpoint (no admin key needed — returns mode only) ── */

  @Get('admin/status')
  getAdminStatus() {
    return { mockErpAdminMode: this.erpAdminMode };
  }

  /* ── Existing endpoints (called by cloud-api) ──────────────── */

  @Post('publish-results')
  async publishResults() {
    this.logger.log('Publishing mock ERP results to cloud-api...');
    return this.erpService.publishResults();
  }

  @Post('validate-student')
  async validateStudent(@Body() body: ValidateStudentBody) {
    this.logger.log(`Validating student ${body.rollNumber}`);
    return this.erpService.validateStudent(body);
  }

  /* ── Admin endpoints (mock ERP management) ─────────────────── */

  @Get('admin/records')
  listRecords(@Headers('authorization') auth?: string) {
    this.assertAdmin(auth);
    return this.erpService.listStudents();
  }

  @Post('admin/upsert')
  upsertRecord(
    @Headers('authorization') auth?: string,
    @Body() body?: UpsertStudentBody,
  ) {
    this.assertAdmin(auth);
    if (!body?.rollNumber?.trim() || !body?.name?.trim()) {
      throw new HttpException('rollNumber and name are required', HttpStatus.BAD_REQUEST);
    }
    return this.erpService.upsertStudent({
      rollNumber: body.rollNumber,
      name: body.name,
      degree: body.degree || 'B.Tech',
      branch: body.branch || 'Computer Science',
      graduationYear: body.graduationYear || 2025,
      cgpa: body.cgpa ?? 8.0,
    });
  }

  @Post('admin/upsert-batch')
  upsertBatch(
    @Headers('authorization') auth?: string,
    @Body() body?: { records?: UpsertStudentBody[] },
  ) {
    this.assertAdmin(auth);
    if (!Array.isArray(body?.records) || body!.records.length === 0) {
      throw new HttpException('records array is required (1-500 items)', HttpStatus.BAD_REQUEST);
    }
    if (body!.records.length > 500) {
      throw new HttpException('Maximum 500 records per batch', HttpStatus.BAD_REQUEST);
    }
    return this.erpService.upsertBatch(
      body!.records.map((r) => ({
        rollNumber: r.rollNumber?.trim() || '',
        name: r.name?.trim() || '',
        degree: r.degree?.trim() || 'B.Tech',
        branch: r.branch?.trim() || 'Computer Science',
        graduationYear: r.graduationYear || 2025,
        cgpa: r.cgpa ?? 8.0,
      })),
    );
  }

  @Delete('admin/records/:rollNumber')
  deleteRecord(
    @Headers('authorization') auth?: string,
    @Param('rollNumber') rollNumber?: string,
  ) {
    this.assertAdmin(auth);
    if (!rollNumber) {
      throw new HttpException('rollNumber param is required', HttpStatus.BAD_REQUEST);
    }
    const deleted = this.erpService.deleteStudent(rollNumber);
    if (!deleted) {
      throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    }
    return { deleted: true, rollNumber };
  }

  @Get('admin/lookup/:rollNumber')
  lookupRecord(
    @Headers('authorization') auth?: string,
    @Param('rollNumber') rollNumber?: string,
  ) {
    this.assertAdmin(auth);
    const student = this.erpService.lookupStudent(rollNumber || '');
    if (!student) {
      throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    }
    return student;
  }
}
