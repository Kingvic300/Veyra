/**
 * Token amount helpers. All on-chain and stored amounts are integer base units
 * (bigint in memory, decimal string at rest / over the wire). Human input is a
 * decimal string such as "1250.50" that is converted using the asset decimals.
 */

const DECIMAL_RE = /^(0|[1-9]\d*)(\.\d+)?$/;
const BASE_UNITS_RE = /^(0|[1-9]\d*)$/;

export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmountError';
  }
}

/** Convert a human decimal string into base units. Rejects excess precision. */
export function parseUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new AmountError(`Invalid decimals: ${decimals}`);
  }
  const trimmed = value.trim();
  if (!DECIMAL_RE.test(trimmed)) {
    throw new AmountError(`Invalid amount "${value}". Use a plain decimal such as 1250.50`);
  }
  const [whole = '0', fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) {
    throw new AmountError(`Amount "${value}" has more than ${decimals} decimal places`);
  }
  const padded = fraction.padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + (padded ? BigInt(padded) : 0n);
}

/** Convert base units into a human decimal string without trailing zeros. */
export function formatUnits(value: bigint | string, decimals: number): string {
  const units = typeof value === 'string' ? parseBaseUnits(value) : value;
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

/** Parse a base-unit integer string (as stored in the database). */
export function parseBaseUnits(value: string): bigint {
  if (!BASE_UNITS_RE.test(value)) {
    throw new AmountError(`Invalid base-unit amount "${value}"`);
  }
  return BigInt(value);
}

export function sumAmounts(values: readonly bigint[]): bigint {
  return values.reduce((acc, v) => acc + v, 0n);
}

/** Maximum value of a Cairo u256 / EVM uint256. */
export const MAX_UINT256 = 2n ** 256n - 1n;
