import { Controller, Post, Get, Delete, Body, Param, Query, Headers, Logger, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ErpService } from './erp.service.js';
import { AdminKeyGuard } from '../guards/admin-key.guard.js';

interface UpsertStudentBody {
  rollNumber: string;
  name: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
}

interface ValidateStudentBody {
  issuerCode: string;
  rollNumber: string;
  name: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
}

@Controller('erp')
export class ErpController {
  private readonly logger = new Logger(ErpController.name);
  private readonly adminKey = process.env.CONNECTOR_ADMIN_KEY || '';

  constructor(private readonly erpService: ErpService) {}

  /* ── Guard helper ──────────────────────────────────────────── */

  private assertAdmin(authHeader?: string): void {
    if (!this.adminKey) {
      throw new HttpException('CONNECTOR_ADMIN_KEY is not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const token = authHeader?.replace(/^[Bb]earer\s+/, '').trim();
    if (token !== this.adminKey) {
      throw new HttpException('Invalid admin key', HttpStatus.UNAUTHORIZED);
    }
  }

  /* ── Health / Status ───────────────────────────────────────── */

  @Get('health')
  async health() {
    return { status: 'ok', database: 'postgres', timestamp: new Date().toISOString() };
  }

  @Get('admin/status')
  @UseGuards(AdminKeyGuard)
  getAdminStatus() {
    return { erpDatabase: 'postgres', adminKeyConfigured: !!this.adminKey };
  }

  /* ── Existing endpoints (called by cloud-api) ──────────────── */

  @Post('publish-results')
  @UseGuards(AdminKeyGuard)
  async publishResults() {
    this.logger.log('Publishing ERP results to cloud-api...');
    return this.erpService.publishResults();
  }

  @Post('validate-student')
  @UseGuards(AdminKeyGuard)
  async validateStudent(@Body() body: ValidateStudentBody) {
    this.logger.log(`Validating student ${body.rollNumber}`);
    return this.erpService.validateStudent(body);
  }

  /* ── Admin endpoints (ERP management) ──────────────────────── */

  @Get('admin/records')
  async listRecords(
    @Headers('authorization') auth?: string,
    @Query('issuerCode') issuerCode?: string,
  ) {
    this.assertAdmin(auth);
    return this.erpService.listStudents(issuerCode);
  }

  @Post('admin/upsert')
  async upsertRecord(
    @Headers('authorization') auth?: string,
    @Body() body?: UpsertStudentBody,
    @Query('issuerCode') issuerCode?: string,
  ) {
    this.assertAdmin(auth);
    if (!body?.rollNumber?.trim() || !body?.name?.trim()) {
      throw new HttpException('rollNumber and name are required', HttpStatus.BAD_REQUEST);
    }
    return this.erpService.upsertStudent(
      {
        rollNumber: body.rollNumber,
        name: body.name,
        degree: body.degree || 'B.Tech',
        branch: body.branch || 'Computer Science',
        graduationYear: body.graduationYear || 2025,
        cgpa: body.cgpa ?? 8.0,
      },
      issuerCode,
    );
  }

  @Post('admin/upsert-batch')
  async upsertBatch(
    @Headers('authorization') auth?: string,
    @Body() body?: { records?: UpsertStudentBody[] },
    @Query('issuerCode') issuerCode?: string,
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
      issuerCode,
    );
  }

  @Delete('admin/records/:rollNumber')
  async deleteRecord(
    @Headers('authorization') auth?: string,
    @Param('rollNumber') rollNumber?: string,
    @Query('issuerCode') issuerCode?: string,
  ) {
    this.assertAdmin(auth);
    if (!rollNumber) {
      throw new HttpException('rollNumber param is required', HttpStatus.BAD_REQUEST);
    }
    const deleted = await this.erpService.deleteStudent(rollNumber, issuerCode);
    if (!deleted) {
      throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    }
    return { deleted: true, rollNumber };
  }

  @Get('admin/lookup/:rollNumber')
  async lookupRecord(
    @Headers('authorization') auth?: string,
    @Param('rollNumber') rollNumber?: string,
    @Query('issuerCode') issuerCode?: string,
  ) {
    this.assertAdmin(auth);
    const student = await this.erpService.lookupStudent(rollNumber || '', issuerCode);
    if (!student) {
      throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    }
    return student;
  }
}
