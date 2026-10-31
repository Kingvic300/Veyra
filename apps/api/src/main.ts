import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app-setup.js';
import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';

async function bootstrap() {
  const config = loadConfig();
  await runMigrations(config.databaseUrl);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { bodyParser: false });
  configureApp(app, config);
  await app.listen(config.port);
  const chains = [config.enableSimulatedChain && 'simulated', ...Object.keys(config.starknetRpc).map((n) => `starknet/${n}`)]
    .filter(Boolean)
    .join(', ');
  Logger.log(`Veyra API on http://localhost:${config.port}/v1 (chains: ${chains || 'none'}, jobs: ${config.redisUrl ? 'bullmq' : 'inline'})`, 'Bootstrap');
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
