import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { KeysModule } from './keys/keys.module.js';
import { PingModule } from './ping/ping.module.js';
import { SignModule } from './sign/sign.module.js';
import { ErpModule } from './erp/erp.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, KeysModule, PingModule, SignModule, ErpModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
