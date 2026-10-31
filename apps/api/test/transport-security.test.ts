import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase, testConfig, type TestApp } from './helpers.js';

let prod: TestApp;

beforeAll(async () => {
  await resetDatabase();
  prod = await createTestApp(testConfig({ NODE_ENV: 'production', ENABLE_SIMULATED_CHAIN: 'false' }));
});

afterAll(async () => {
  await prod?.app.close();
});

describe('transport security in production', () => {
  it('refuses requests that did not arrive over HTTPS', async () => {
    const res = await prod.http().post('/v1/auth/login').send({ email: 'a@acme.dev', password: 'whatever1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('HTTPS_REQUIRED');
  });

  it('serves requests the load balancer marks as HTTPS', async () => {
    const res = await prod.http().post('/v1/auth/login').set('X-Forwarded-Proto', 'https').send({ email: 'a@acme.dev', password: 'whatever1' });
    expect(res.status).toBe(401);
  });

  it('lets load balancer health checks through over plain HTTP', async () => {
    expect((await prod.http().get('/v1/health')).status).toBe(200);
  });

  it('sends strict HSTS and keeps responses out of caches', async () => {
    const res = await prod.http().get('/v1/health');
    expect(res.headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
