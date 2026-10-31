import { describe, expect, it } from 'vitest';
import { BullTxMonitor } from '../src/jobs/tx-monitor.js';
import { testConfig } from './helpers.js';

const REDIS = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';

describe('BullTxMonitor', () => {
  it('retries until the handler reports done and dedupes identical jobs', async () => {
    const monitor = new BullTxMonitor(testConfig({ REDIS_URL: REDIS, TX_POLL_INTERVAL_SECONDS: '0.05' }));
    const id = `test-${Date.now()}`;
    let calls = 0;
    const finished = new Promise<void>((resolve) => {
      monitor.setHandler(async (job) => {
        if (job.id !== id) return 'done';
        calls += 1;
        if (calls < 3) return 'retry';
        resolve();
        return 'done';
      });
    });
    await monitor.enqueue({ kind: 'execution', id });
    await monitor.enqueue({ kind: 'execution', id });
    await finished;
    await new Promise((r) => setTimeout(r, 200));
    expect(calls).toBe(3);
    await monitor.close();
  });
});
