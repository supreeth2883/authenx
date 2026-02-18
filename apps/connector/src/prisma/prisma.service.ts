import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to ERP database');

      // Production health check — verify the connection is truly alive
      await this.$executeRawUnsafe('SELECT 1');
      this.logger.log('Database health check passed (SELECT 1)');
    } catch (err) {
      this.logger.error(`Failed to connect to ERP database: ${(err as Error).message}`);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
