import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { AppConfig } from './config.js';
import { CSRF_HEADER } from './auth/auth.guard.js';

/** Apply middleware shared by the server and the e2e tests. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  express.set('trust proxy', 1);
  express.use(helmet());
  express.enableCors({
    origin: config.dashboardOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER, 'Idempotency-Key'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  express.useBodyParser('json', { limit: '256kb' });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
}
