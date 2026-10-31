import { hash, num, validateAndParseAddress } from 'starknet';
import type { BatchPlan, ChainCall } from '@veyra/chain-adapter';

const U128_MASK = (1n << 128n) - 1n;

export function splitU256(value: bigint): [string, string] {
  if (value < 0n || value >= 1n << 256n) throw new RangeError(`Value out of u256 range: ${value}`);
  return [num.toHex(value & U128_MASK), num.toHex(value >> 128n)];
}

export function joinU256(low: string, high: string): bigint {
  return BigInt(low) + (BigInt(high) << 128n);
}

/** Canonical 0x + 64 hex form. Throws on invalid input. */
export function normaliseAddress(address: string): string {
  return validateAndParseAddress(address.trim()).toLowerCase();
}

export function sameAddress(a: string, b: string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

/**
 * poseidon([batch_id, token, n, r_0, a_0.low, a_0.high, ...]).
 * Must match `_items_hash` in chains/starknet/contracts/src/payroll_vault.cairo.
 */
export function computeItemsHash(
  batchId: string,
  token: string,
  items: readonly { recipient: string; amount: bigint }[],
): string {
  const data: string[] = [num.toHex(batchId), num.toHex(token), num.toHex(items.length)];
  for (const item of items) {
    const [low, high] = splitU256(item.amount);
    data.push(num.toHex(item.recipient), low, high);
  }
  return num.toHex(hash.computePoseidonHashOnElements(data));
}

/** ERC-20 `transfer(recipient, amount: u256)` on the token contract. */
export function transferCall(token: string, recipient: string, amount: bigint): ChainCall {
  return { contractAddress: normaliseAddress(token), entrypoint: 'transfer', calldata: [normaliseAddress(recipient), ...splitU256(amount)] };
}

export function selector(name: string): string {
  return num.toHex(hash.getSelectorFromName(name));
}

export function proposeCall(vault: string, plan: BatchPlan, itemsHash: string): ChainCall {
  const [low, high] = splitU256(plan.total);
  return {
    contractAddress: vault,
    entrypoint: 'propose_batch',
    calldata: [num.toHex(plan.chainBatchId), num.toHex(plan.asset.address), low, high, num.toHex(plan.items.length), itemsHash],
  };
}

export function approveCall(vault: string, plan: BatchPlan): ChainCall {
  return { contractAddress: vault, entrypoint: 'approve_batch', calldata: [num.toHex(plan.chainBatchId)] };
}

export function cancelCall(vault: string, plan: BatchPlan): ChainCall {
  return { contractAddress: vault, entrypoint: 'cancel_batch', calldata: [num.toHex(plan.chainBatchId)] };
}

export function executeCall(vault: string, plan: BatchPlan): ChainCall {
  const calldata = [num.toHex(plan.chainBatchId), num.toHex(plan.items.length)];
  for (const item of plan.items) calldata.push(num.toHex(item.recipient));
  calldata.push(num.toHex(plan.items.length));
  for (const item of plan.items) calldata.push(...splitU256(item.amount));
  return { contractAddress: vault, entrypoint: 'execute_batch', calldata };
}

export const BATCH_STATUS = ['None', 'Proposed', 'Executed', 'Cancelled'] as const;
export type OnchainBatchStatus = (typeof BATCH_STATUS)[number];

export interface OnchainBatch {
  token: string;
  total: bigint;
  itemCount: number;
  itemsHash: string;
  approvals: number;
  status: OnchainBatchStatus;
  proposer: string;
  configVersion: bigint;
}

/** Decode the Serde output of `PayrollVault::get_batch`. */
export function decodeBatch(result: readonly string[]): OnchainBatch {
  if (result.length < 9) throw new Error(`Unexpected get_batch result length ${result.length}`);
  const [token, low, high, count, itemsHash, approvals, status, proposer, version] = result as [
    string, string, string, string, string, string, string, string, string,
  ];
  const statusName = BATCH_STATUS[Number(BigInt(status))];
  if (!statusName) throw new Error(`Unknown batch status ${status}`);
  return {
    token: num.toHex(token),
    total: joinU256(low, high),
    itemCount: Number(BigInt(count)),
    itemsHash: num.toHex(itemsHash),
    approvals: Number(BigInt(approvals)),
    status: statusName,
    proposer: num.toHex(proposer),
    configVersion: BigInt(version),
  };
}
