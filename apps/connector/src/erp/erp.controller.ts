import { Controller, Post, Body, Logger } from '@nestjs/common';
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

@Controller('erp')
export class ErpController {
  private readonly logger = new Logger(ErpController.name);

  constructor(private readonly erpService: ErpService) {}

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
}
