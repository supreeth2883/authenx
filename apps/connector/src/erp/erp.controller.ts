import { Controller, Post, Logger } from '@nestjs/common';
import { ErpService } from './erp.service.js';

@Controller('erp')
export class ErpController {
  private readonly logger = new Logger(ErpController.name);

  constructor(private readonly erpService: ErpService) {}

  @Post('publish-results')
  async publishResults() {
    this.logger.log('Publishing mock ERP results to cloud-api...');
    return this.erpService.publishResults();
  }
}
