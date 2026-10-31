import { describe, expect, it } from 'vitest';
import { AmountError, formatUnits, parseBaseUnits, parseUnits } from '../src/money';

describe('money', () => {
  it('parses decimals into base units', () => {
    expect(parseUnits('1250.5', 6)).toBe(1_250_500_000n);
    expect(parseUnits('0', 18)).toBe(0n);
    expect(parseUnits('1', 0)).toBe(1n);
    expect(parseUnits(' 42.000001 ', 6)).toBe(42_000_001n);
  });

  it('rejects bad input and excess precision', () => {
    expect(() => parseUnits('1.0000001', 6)).toThrow(AmountError);
    expect(() => parseUnits('-1', 6)).toThrow(AmountError);
    expect(() => parseUnits('1e6', 6)).toThrow(AmountError);
    expect(() => parseUnits('01', 6)).toThrow(AmountError);
    expect(() => parseUnits('', 6)).toThrow(AmountError);
  });

  it('formats base units', () => {
    expect(formatUnits(1_250_500_000n, 6)).toBe('1250.5');
    expect(formatUnits('1000000', 6)).toBe('1');
    expect(formatUnits(1n, 18)).toBe('0.000000000000000001');
  });

  it('round-trips', () => {
    for (const v of ['0.1', '999999999.123456', '7']) expect(formatUnits(parseUnits(v, 6), 6)).toBe(v);
  });

  it('validates base unit strings', () => {
    expect(parseBaseUnits('100')).toBe(100n);
    expect(() => parseBaseUnits('1.5')).toThrow(AmountError);
  });
});
