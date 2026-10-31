import { describe, expect, it } from 'vitest';
import { computeBatchCommitment, validateBatch, type BatchItemInput } from '../src/payroll';

const policy = { threshold: 2, allowCreatorApproval: false, maxBatchTotal: null };
const opts = { maxItems: 50, policy, isValidRecipient: (a: string) => a.startsWith('0x') };
const item = (id: string, amount: bigint, recipient: string | null = `0x${id}`): BatchItemInput => ({
  contractorId: id,
  recipient,
  amount,
  contractorActive: true,
});

describe('validateBatch', () => {
  it('accepts a valid batch and totals it', () => {
    const r = validateBatch([item('a', 100n), item('b', 250n), item('c', 50n)], opts);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(400n);
  });

  it('flags empty, zero amounts, missing and invalid recipients, duplicates', () => {
    expect(validateBatch([], opts).issues.map((i) => i.code)).toContain('EMPTY_BATCH');
    const r = validateBatch(
      [item('a', 0n), item('b', 1n, null), item('c', 1n, 'bad'), item('d', 1n), item('d', 2n)],
      opts,
    );
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual([
      'NON_POSITIVE_AMOUNT',
      'MISSING_RECIPIENT',
      'INVALID_RECIPIENT',
      'DUPLICATE_CONTRACTOR',
    ]);
  });

  it('enforces the policy spending limit', () => {
    const r = validateBatch([item('a', 1001n)], { ...opts, policy: { ...policy, maxBatchTotal: '1000' } });
    expect(r.issues.map((i) => i.code)).toEqual(['EXCEEDS_POLICY_LIMIT']);
  });

  it('warns but does not block on insufficient treasury', () => {
    const r = validateBatch([item('a', 500n)], { ...opts, availableBalance: 100n });
    expect(r.ok).toBe(true);
    expect(r.issues[0]?.severity).toBe('warning');
  });

  it('enforces the item limit', () => {
    const items = Array.from({ length: 3 }, (_, i) => item(String(i), 1n));
    expect(validateBatch(items, { ...opts, maxItems: 2 }).issues[0]?.code).toBe('TOO_MANY_ITEMS');
  });
});

describe('computeBatchCommitment', () => {
  const base = {
    batchId: 'b1',
    organisationId: 'o1',
    chain: 'starknet',
    network: 'sepolia',
    asset: '0xABC',
    items: [{ recipient: '0x1', amount: 5n }],
  };

  it('is deterministic and case-insensitive for addresses', async () => {
    const a = await computeBatchCommitment(base);
    const b = await computeBatchCommitment({ ...base, asset: '0xabc' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when an amount changes', async () => {
    const a = await computeBatchCommitment(base);
    const b = await computeBatchCommitment({ ...base, items: [{ recipient: '0x1', amount: 6n }] });
    expect(a).not.toBe(b);
  });
});
