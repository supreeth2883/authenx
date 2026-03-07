import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  // ── Production startup checks ──────────────────────────────────
  if (isProd) {
    if (!process.env.CONNECTOR_ADMIN_KEY) {
      console.error('FATAL: CONNECTOR_ADMIN_KEY is required in production.');
      process.exit(1);
    }
    if (!process.env.ISSUER_CODE) {
      console.error('FATAL: ISSUER_CODE is required in production.');
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);

  // CORS — restrict to cloud-api origin in production
  if (isProd && process.env.CLOUD_API_URL) {
    app.enableCors({
      origin: process.env.CLOUD_API_URL,
      methods: ['GET', 'POST'],
      credentials: false,
    });
  } else {
    app.enableCors();
  }

  const port = process.env.PORT ?? 3002;
  // Bind to 0.0.0.0 — required for Docker / Render (default may bind to localhost)
  await app.listen(port, '0.0.0.0');
  console.log(`Connector running on http://0.0.0.0:${port} (${process.env.NODE_ENV || 'development'})`);
}

bootstrap();
