import { describe, expect, it } from 'vitest';
import { AdapterRegistry, ChainAdapterError, SimulatedAdapter, compareTransfers, type BatchPlan } from '../src';

const asset = { address: 'sim:usdc', symbol: 'USDC', decimals: 6 };
const plan = (over: Partial<BatchPlan> = {}): BatchPlan => ({
  chainBatchId: '0x01',
  asset,
  treasuryAddress: 'sim:treasury',
  items: [
    { recipient: 'sim:alice', amount: 100n },
    { recipient: 'sim:bob', amount: 250n },
  ],
  total: 350n,
  ...over,
});

describe('SimulatedAdapter', () => {
  it('validates simulated and hex addresses', () => {
    const a = new SimulatedAdapter();
    expect(a.isValidAddress('sim:alice')).toBe(true);
    expect(a.isValidAddress('0xabc')).toBe(true);
    expect(a.isValidAddress('alice')).toBe(false);
    expect(a.normaliseAddress(' SIM:Alice ')).toBe('sim:alice');
    expect(() => a.normaliseAddress('nope')).toThrow(ChainAdapterError);
  });

  it('declares API-enforced approvals and no privacy', () => {
    const caps = new SimulatedAdapter().getCapabilities();
    expect(caps.onChainApprovals).toBe(false);
    expect(caps.privacy.shieldedTransfers).toBe(false);
    expect(caps.privacy.disclosures.length).toBeGreaterThan(0);
  });

  it('executes atomically and verifies the payment', async () => {
    const a = new SimulatedAdapter({ defaultBalance: 1000n });
    const ref = await a.submitTransaction({ kind: 'execute', plan: plan() });
    expect((await a.getTransaction(ref)).state).toBe('FINALISED');
    expect(await a.getBalance('sim:treasury', asset)).toBe(650n);
    expect(await a.getBalance('sim:bob', asset)).toBe(1250n);
    const v = await a.verifyPayment(ref, plan());
    expect(v.verified).toBe(true);
  });

  it('reverts without moving funds when the treasury is short', async () => {
    const a = new SimulatedAdapter({ defaultBalance: 100n });
    const ref = await a.submitTransaction({ kind: 'execute', plan: plan() });
    const status = await a.getTransaction(ref);
    expect(status.state).toBe('REVERTED');
    expect(status.error).toMatch(/Insufficient/);
    expect(await a.getBalance('sim:treasury', asset)).toBe(100n);
    expect((await a.verifyPayment(ref, plan())).verified).toBe(false);
  });

  it('refuses to execute the same batch twice', async () => {
    const a = new SimulatedAdapter({ defaultBalance: 10_000n });
    await a.submitTransaction({ kind: 'execute', plan: plan() });
    const second = await a.submitTransaction({ kind: 'execute', plan: plan() });
    expect((await a.getTransaction(second)).error).toBe('Batch already executed');
    expect(await a.getBalance('sim:treasury', asset)).toBe(9650n);
  });

  it('detects a verification against the wrong plan', async () => {
    const a = new SimulatedAdapter({ defaultBalance: 10_000n });
    const ref = await a.submitTransaction({ kind: 'execute', plan: plan() });
    const v = await a.verifyPayment(ref, plan({ items: [{ recipient: 'sim:alice', amount: 350n }] }));
    expect(v.verified).toBe(false);
  });

  it('reports unknown transactions', async () => {
    const a = new SimulatedAdapter();
    expect((await a.getTransaction({ chain: 'simulated', network: 'local', txHash: '0x1' })).state).toBe('NOT_FOUND');
  });

  it('enforces batch size and treasury config', () => {
    const a = new SimulatedAdapter({ maxBatchSize: 1 });
    expect(() => a.createPayment(plan())).toThrow(/exceeds/);
    expect(() => new SimulatedAdapter().createPayment(plan({ treasuryAddress: null }))).toThrow(/Treasury/);
  });
});

describe('compareTransfers', () => {
  it('matches duplicates as a multiset', () => {
    const p = plan({ items: [{ recipient: 'sim:a', amount: 1n }, { recipient: 'sim:a', amount: 1n }] });
    expect(compareTransfers(p, [{ to: 'sim:a', amount: 1n }])).toEqual(['Missing transfer of 1 to sim:a']);
    expect(compareTransfers(p, [{ to: 'sim:a', amount: 1n }, { to: 'sim:a', amount: 1n }, { to: 'sim:x', amount: 9n }])).toEqual([
      'Unexpected transfer of 9 to sim:x',
    ]);
  });
});

describe('AdapterRegistry', () => {
  it('caches adapters and rejects unknown chains or modes', () => {
    const r = new AdapterRegistry().register('simulated', (k) => new SimulatedAdapter({ network: k.network }));
    const key = { chain: 'simulated' as const, network: 'local', executionMode: 'simulated' as const };
    expect(r.get(key)).toBe(r.get(key));
    expect(() => r.get({ ...key, chain: 'starknet' })).toThrow(/not enabled/);
    expect(() => r.get({ ...key, executionMode: 'vault' })).toThrow(/does not support/);
  });
});
