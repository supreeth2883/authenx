import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query('role') role?: UserRole,
    @Query('issuerCode') issuerCode?: string,
    @Query('q') q?: string,
    @Query('active') activeStr?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(parseInt(pageStr || '1', 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(limitStr || '20', 10) || 20, 1),
      100,
    );
    const active =
      activeStr === 'true' ? true : activeStr === 'false' ? false : undefined;

    return this.usersService.findAll({ role, issuerCode, q, active, page, limit });
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @Req() req: Request) {
    const actor = (req as any).user?.email ?? 'unknown';
    this.logger.log(
      `[AUDIT] CREATE_USER by=${actor} email=${dto.email} role=${dto.role}`,
    );
    return this.usersService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const actor = (req as any).user?.email ?? 'unknown';
    this.logger.log(
      `[AUDIT] UPDATE_USER by=${actor} targetId=${id} fields=${Object.keys(dto).join(',')}`,
    );
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor = (req as any).user?.email ?? 'unknown';
    this.logger.log(`[AUDIT] DEACTIVATE_USER by=${actor} targetId=${id}`);
    return this.usersService.deactivate(id);
  }
}
