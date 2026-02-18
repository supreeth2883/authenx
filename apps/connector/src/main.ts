import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for cloud-api calls
  app.enableCors();

  const port = process.env.PORT ?? 3002;
  // Bind to 0.0.0.0 — required for Docker / Render (default may bind to localhost)
  await app.listen(port, '0.0.0.0');
  console.log(`Connector running on http://0.0.0.0:${port}`);
}

bootstrap();
