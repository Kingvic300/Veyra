/**
 * Convert a UUID into a 128-bit integer represented as a 0x-prefixed hex string.
 * Fits inside a Starknet felt252 and EVM uint256, so the same batch id can be
 * referenced on-chain without a lookup table.
 */
export function uuidToHex(uuid: string): string {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`Invalid UUID: ${uuid}`);
  return `0x${hex}`;
}

export function hexToUuid(hex: string): string {
  const h = hex.replace(/^0x/, '').padStart(32, '0').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(h)) throw new Error(`Invalid 128-bit hex: ${hex}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
