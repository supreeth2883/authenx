import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import * as winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, context, ...meta }) => {
  const ctx = context ? `[${context}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level} ${ctx} ${message}${metaStr}`;
});

// Create the Winston logger instance
function createLogger(isProd: boolean, logLevel: string): winston.Logger {
  const formats = isProd
    ? [timestamp(), json()]
    : [timestamp({ format: 'HH:mm:ss' }), colorize(), devFormat];

  return winston.createLogger({
    level: logLevel,
    format: combine(...formats),
    transports: [
      new winston.transports.Console(),
      // In production, also write to files
      ...(isProd
        ? [
            new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
            new winston.transports.File({ filename: 'logs/combined.log' }),
          ]
        : []),
    ],
  });
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');
    this.logger = createLogger(isProd, logLevel);
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context: context || this.context });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context: context || this.context });
  }

  /**
   * Structured log with request context
   */
  logRequest(data: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    ip?: string;
    userId?: string;
    role?: string;
    userAgent?: string;
    requestId?: string;
  }): void {
    this.logger.info('HTTP Request', {
      context: 'HTTP',
      ...data,
    });
  }

  /**
   * Structured log for security events
   */
  logSecurity(data: {
    action: string;
    ip?: string;
    userId?: string;
    role?: string;
    success: boolean;
    detail?: string;
  }): void {
    const level = data.success ? 'info' : 'warn';
    this.logger[level]('Security Event', {
      context: 'SECURITY',
      ...data,
    });
  }

  /**
   * Structured log for audit events
   */
  logAudit(data: {
    action: string;
    resourceType: string;
    resourceId: string;
    userId?: string;
    role?: string;
    ip?: string;
    changes?: Record<string, unknown>;
  }): void {
    this.logger.info('Audit Event', {
      context: 'AUDIT',
      ...data,
    });
  }
}
