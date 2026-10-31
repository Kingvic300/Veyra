import { describe, expect, it } from 'vitest';
import { createBatchSchema, createContractorSchema, registerSchema } from '../src/schemas';

describe('schemas', () => {
  it('normalises email and enforces password length', () => {
    expect(registerSchema.parse({ email: 'A@B.CO', name: 'Ada', password: 'x'.repeat(12) }).email).toBe('a@b.co');
    expect(registerSchema.safeParse({ email: 'a@b.co', name: 'Ada', password: 'short' }).success).toBe(false);
  });

  it('uppercases country codes', () => {
    expect(createContractorSchema.parse({ name: 'Ngozi', country: 'ng', payoutAddress: '0x1' }).country).toBe('NG');
  });

  it('rejects scientific notation amounts', () => {
    const r = createBatchSchema.safeParse({ title: 'Oct', items: [{ contractorId: '0f8e2c4a-1b3d-4e5f-8a9b-0c1d2e3f4a5b', amount: '1e3' }] });
    expect(r.success).toBe(false);
  });
});
