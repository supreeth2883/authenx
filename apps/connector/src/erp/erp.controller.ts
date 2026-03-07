import { Controller, Post, Get, Delete, Body, Param, Query, Logger, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
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

  constructor(private readonly erpService: ErpService) {}

  /* ── Health / Status ───────────────────────────────────────── */

  @Get('health')
  async health() {
    return { status: 'ok', database: 'postgres', timestamp: new Date().toISOString() };
  }

  @Get('admin/status')
  @UseGuards(AdminKeyGuard)
  getAdminStatus() {
    return { erpDatabase: 'postgres', adminKeyConfigured: !!process.env.CONNECTOR_ADMIN_KEY };
  }

  /* ── Endpoints called by cloud-api ─────────────────────────── */

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
  @UseGuards(AdminKeyGuard)
  async listRecords(@Query('issuerCode') issuerCode?: string) {
    return this.erpService.listStudents(issuerCode);
  }

  @Post('admin/upsert')
  @UseGuards(AdminKeyGuard)
  async upsertRecord(
    @Body() body: UpsertStudentBody,
    @Query('issuerCode') issuerCode?: string,
  ) {
    if (!body?.rollNumber?.trim() || !body?.name?.trim()) {
      throw new HttpException('rollNumber and name are required', HttpStatus.BAD_REQUEST);
    }
    return this.erpService.upsertStudent(
      {
        rollNumber: body.rollNumber.trim(),
        name: body.name.trim(),
        degree: body.degree || 'B.Tech',
        branch: body.branch || 'Computer Science',
        graduationYear: body.graduationYear || 2025,
        cgpa: body.cgpa ?? 8.0,
      },
      issuerCode,
    );
  }

  @Post('admin/upsert-batch')
  @UseGuards(AdminKeyGuard)
  async upsertBatch(
    @Body() body: { records?: UpsertStudentBody[] },
    @Query('issuerCode') issuerCode?: string,
  ) {
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
  @UseGuards(AdminKeyGuard)
  async deleteRecord(
    @Param('rollNumber') rollNumber: string,
    @Query('issuerCode') issuerCode?: string,
  ) {
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
  @UseGuards(AdminKeyGuard)
  async lookupRecord(
    @Param('rollNumber') rollNumber: string,
    @Query('issuerCode') issuerCode?: string,
  ) {
    const student = await this.erpService.lookupStudent(rollNumber || '', issuerCode);
    if (!student) {
      throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
    }
    return student;
  }
}
