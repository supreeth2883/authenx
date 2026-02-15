import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { LoggerService } from './logger/logger.service.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const logger = new LoggerService();
  logger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Cookie parser for JWT cookies
  app.use(cookieParser());

  // Helmet security headers
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false, // Disable CSP in dev for easier debugging
      // Prevent MIME type sniffing
      noSniff: true,
      // X-XSS-Protection header
      xssFilter: true,
      // X-Frame-Options: DENY
      frameguard: { action: 'deny' },
      // Hide X-Powered-By header
      hidePoweredBy: true,
      // HSTS in production only
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  // CORS configuration - restrict in production
  const allowedOrigins = isProd
    ? (process.env.CORS_ORIGIN || 'https://authenx.io').split(',').map((o) => o.trim())
    : [process.env.CORS_ORIGIN || 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`Cloud API running on http://localhost:${port} (${process.env.NODE_ENV || 'development'})`);
  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();
