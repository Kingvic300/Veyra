import { describe, expect, it } from 'vitest';
import { hexToUuid, uuidToHex } from '../src/ids';

describe('ids', () => {
  it('round-trips uuid and hex', () => {
    const id = '0f8e2c4a-1b3d-4e5f-8a9b-0c1d2e3f4a5b';
    expect(uuidToHex(id)).toBe('0x0f8e2c4a1b3d4e5f8a9b0c1d2e3f4a5b');
    expect(hexToUuid(uuidToHex(id))).toBe(id);
  });
  it('rejects invalid uuids', () => {
    expect(() => uuidToHex('nope')).toThrow();
  });
});
