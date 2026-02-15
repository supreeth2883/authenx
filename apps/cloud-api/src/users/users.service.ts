import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/** Safe user shape — never includes passwordHash */
export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  issuerCode: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SAFE_SELECT = {
  id: true,
  email: true,
  role: true,
  issuerCode: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    role?: UserRole;
    issuerCode?: string;
    q?: string;
    active?: boolean;
    page: number;
    limit: number;
  }) {
    const { role, issuerCode, q, active, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    const conditions: Prisma.UserWhereInput[] = [];

    if (role) conditions.push({ role });
    if (issuerCode) conditions.push({ issuerCode });
    if (active !== undefined) conditions.push({ active });
    if (q?.trim()) {
      conditions.push({
        email: { contains: q.trim(), mode: 'insensitive' },
      });
    }
    if (conditions.length > 0) where.AND = conditions;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: {
    email: string;
    password: string;
    role: UserRole;
    issuerCode?: string;
  }): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        issuerCode: data.issuerCode ?? null,
      },
      select: SAFE_SELECT,
    });

    this.logger.log(`User created: ${user.email} (${user.role})`);
    return user;
  }

  async update(
    id: string,
    data: {
      role?: UserRole;
      issuerCode?: string;
      active?: boolean;
      password?: string;
    },
  ): Promise<SafeUser> {
    await this.findById(id); // throws if not found

    const updateData: Prisma.UserUpdateInput = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (data.issuerCode !== undefined) updateData.issuerCode = data.issuerCode;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(
        data.password,
        this.SALT_ROUNDS,
      );
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: SAFE_SELECT,
    });

    this.logger.log(`User updated: ${user.email} — fields: ${Object.keys(data).join(', ')}`);
    return user;
  }

  async deactivate(id: string): Promise<SafeUser> {
    await this.findById(id); // throws if not found

    const user = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: SAFE_SELECT,
    });

    this.logger.log(`User deactivated: ${user.email}`);
    return user;
  }
}
