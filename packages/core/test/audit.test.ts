import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, hashAuditEvent, verifyAuditChain, type AuditEventBody } from '../src/audit';
import { canonicalJson } from '../src/hash';

async function chain(n: number) {
  const events: (AuditEventBody & { hash: string })[] = [];
  let prev = GENESIS_HASH;
  for (let seq = 1; seq <= n; seq++) {
    const body: AuditEventBody = {
      organisationId: 'org',
      seq,
      actorId: 'u1',
      action: 'batch.created',
      entityType: 'batch',
      entityId: `b${seq}`,
      data: { total: String(seq * 100) },
      createdAt: new Date(Date.UTC(2026, 9, 31, 0, 0, seq)).toISOString(),
      prevHash: prev,
    };
    const hash = await hashAuditEvent(body);
    events.push({ ...body, hash });
    prev = hash;
  }
  return events;
}

describe('audit chain', () => {
  it('canonicalises key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3] } })).toBe('{"a":{"c":[3],"d":2},"b":1}');
    expect(() => canonicalJson({ a: 1n })).toThrow(TypeError);
  });

  it('verifies an untouched chain', async () => {
    const result = await verifyAuditChain(await chain(5));
    expect(result).toEqual({ valid: true, checked: 5, brokenAt: null, reason: null });
  });

  it('detects altered content', async () => {
    const events = await chain(4);
    events[2]!.data = { total: '999999' };
    const result = await verifyAuditChain(events);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(3);
  });

  it('detects deleted events', async () => {
    const events = await chain(4);
    events.splice(1, 1);
    const result = await verifyAuditChain(events);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(3);
  });
});
