import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-setup.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { runMigrations } from '../src/db/migrate.js';
import { InlineTxMonitor, TxMonitor } from '../src/jobs/tx-monitor.js';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://veyra:veyra@localhost:5432/veyra_test';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DB,
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    VEYRA_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'),
    ENABLE_SIMULATED_CHAIN: 'true',
    TX_POLL_INTERVAL_SECONDS: '0.02',
    STARKNET_RPC_DEVNET: 'http://127.0.0.1:1/unused',
    ...overrides,
  });
}

export async function resetDatabase() {
  const client = new pg.Client({ connectionString: TEST_DB });
  await client.connect();
  await client.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await client.end();
  await runMigrations(TEST_DB);
}

export async function sql(query: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DB });
  await client.connect();
  try {
    return await client.query(query, params);
  } finally {
    await client.end();
  }
}

export interface TestApp {
  app: INestApplication;
  config: AppConfig;
  monitor: InlineTxMonitor;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(config = testConfig()): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app, config);
  await app.init();
  return {
    app,
    config,
    monitor: app.get(TxMonitor) as InlineTxMonitor,
    http: () => request(app.getHttpServer()),
  };
}

export class Client {
  token = '';
  userId = '';
  constructor(
    private readonly t: TestApp,
    readonly email: string,
  ) {}

  async register(name: string) {
    const res = await this.t.http().post('/v1/auth/register').send({ email: this.email, name, password: 'correct horse battery' });
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    this.token = res.body.token;
    this.userId = res.body.user.id;
    return this;
  }

  get(path: string) {
    return this.t.http().get(`/v1${path}`).set('Authorization', `Bearer ${this.token}`);
  }
  post(path: string, body: unknown = {}) {
    return this.t.http().post(`/v1${path}`).set('Authorization', `Bearer ${this.token}`).send(body as object);
  }
  patch(path: string, body: unknown) {
    return this.t.http().patch(`/v1${path}`).set('Authorization', `Bearer ${this.token}`).send(body as object);
  }
  delete(path: string) {
    return this.t.http().delete(`/v1${path}`).set('Authorization', `Bearer ${this.token}`);
  }
}

export function expectStatus(res: { status: number; body: unknown }, status: number) {
  if (res.status !== status) throw new Error(`Expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
}
