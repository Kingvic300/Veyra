import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config.js';
import { CSRF_HEADER } from './auth/auth.guard.js';

/** Paths load balancers probe over plain HTTP inside the private network. */
const PLAIN_HTTP_ALLOWED = new Set(['/v1/health']);

/** Apply middleware shared by the server and the e2e tests. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  // One proxy hop (the load balancer) sets X-Forwarded-Proto, so req.secure reflects the client's connection.
  express.set('trust proxy', 1);

  if (config.env === 'production') {
    // Refuse plain HTTP outright: redirecting would already have sent the body and cookie in clear text.
    express.use((req: Request, res: Response, next: NextFunction) => {
      if (req.secure || PLAIN_HTTP_ALLOWED.has(req.path)) return next();
      res.status(403).json({ error: { code: 'HTTPS_REQUIRED', message: 'Use HTTPS' } });
    });
  }

  express.use(
    helmet({
      // Two years, subdomains included, eligible for browser preload lists.
      strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    }),
  );
  // Every response carries private data; keep it out of browser and proxy caches.
  express.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
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
