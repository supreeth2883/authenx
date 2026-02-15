import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service.js';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;

    // Extract user info from JWT if available
    const user = (req as any).user;
    const userId = user?.sub || user?.id;
    const role = user?.role;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      this.logger.logRequest({
        method,
        path: originalUrl,
        statusCode,
        duration,
        ip: ip || req.headers['x-forwarded-for']?.toString(),
        userId,
        role,
        userAgent: req.headers['user-agent'],
      });
    });

    next();
  }
}
