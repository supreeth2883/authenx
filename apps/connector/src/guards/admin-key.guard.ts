import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * NestJS guard that enforces CONNECTOR_ADMIN_KEY on protected routes.
 *
 * Usage:
 *   @UseGuards(AdminKeyGuard)       // class-level or method-level
 *
 * Callers must send:
 *   Authorization: Bearer <CONNECTOR_ADMIN_KEY>
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const adminKey = process.env.CONNECTOR_ADMIN_KEY;
    if (!adminKey) {
      throw new HttpException(
        'CONNECTOR_ADMIN_KEY is not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    const token = authHeader?.replace(/^[Bb]earer\s+/, '').trim();

    if (token !== adminKey) {
      throw new HttpException('Invalid admin key', HttpStatus.UNAUTHORIZED);
    }

    return true;
  }
}
