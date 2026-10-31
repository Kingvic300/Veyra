import { joinU256, sameAddress, selector } from './encoding';

export interface RawEvent {
  from_address: string;
  keys: string[];
  data: string[];
}

const SEL = {
  BatchProposed: selector('BatchProposed'),
  BatchApproved: selector('BatchApproved'),
  BatchExecuted: selector('BatchExecuted'),
  PaymentSent: selector('PaymentSent'),
  BatchCancelled: selector('BatchCancelled'),
  Transfer: selector('Transfer'),
};

function is(event: RawEvent, name: keyof typeof SEL, from: string): boolean {
  return sameAddress(event.from_address, from) && event.keys.length > 0 && BigInt(event.keys[0]!) === BigInt(SEL[name]);
}

export interface ProposedEvent {
  batchId: bigint;
  proposer: string;
  token: string;
  total: bigint;
  itemCount: number;
  itemsHash: bigint;
}

export function findProposed(events: readonly RawEvent[], vault: string): ProposedEvent[] {
  return events
    .filter((e) => is(e, 'BatchProposed', vault) && e.keys.length >= 2 && e.data.length >= 6)
    .map((e) => ({
      batchId: BigInt(e.keys[1]!),
      proposer: e.data[0]!,
      token: e.data[1]!,
      total: joinU256(e.data[2]!, e.data[3]!),
      itemCount: Number(BigInt(e.data[4]!)),
      itemsHash: BigInt(e.data[5]!),
    }));
}

export function findApproved(events: readonly RawEvent[], vault: string): { batchId: bigint; approver: string; approvals: number }[] {
  return events
    .filter((e) => is(e, 'BatchApproved', vault) && e.keys.length >= 3 && e.data.length >= 1)
    .map((e) => ({ batchId: BigInt(e.keys[1]!), approver: e.keys[2]!, approvals: Number(BigInt(e.data[0]!)) }));
}

export function findExecuted(
  events: readonly RawEvent[],
  vault: string,
): { batchId: bigint; executor: string; token: string; total: bigint; itemCount: number }[] {
  return events
    .filter((e) => is(e, 'BatchExecuted', vault) && e.keys.length >= 2 && e.data.length >= 5)
    .map((e) => ({
      batchId: BigInt(e.keys[1]!),
      executor: e.data[0]!,
      token: e.data[1]!,
      total: joinU256(e.data[2]!, e.data[3]!),
      itemCount: Number(BigInt(e.data[4]!)),
    }));
}

export function findPayments(events: readonly RawEvent[], vault: string): { batchId: bigint; to: string; amount: bigint }[] {
  return events
    .filter((e) => is(e, 'PaymentSent', vault) && e.keys.length >= 3 && e.data.length >= 2)
    .map((e) => ({ batchId: BigInt(e.keys[1]!), to: e.keys[2]!, amount: joinU256(e.data[0]!, e.data[1]!) }));
}

/**
 * ERC-20 Transfer events emitted by the token. Supports both the Cairo 1
 * OpenZeppelin layout (from/to as keys) and the legacy layout (all in data).
 */
export function findTokenTransfers(events: readonly RawEvent[], token: string): { from: string; to: string; amount: bigint }[] {
  const out: { from: string; to: string; amount: bigint }[] = [];
  for (const e of events) {
    if (!is(e, 'Transfer', token)) continue;
    if (e.keys.length >= 3 && e.data.length >= 2) {
      out.push({ from: e.keys[1]!, to: e.keys[2]!, amount: joinU256(e.data[0]!, e.data[1]!) });
    } else if (e.keys.length === 1 && e.data.length >= 4) {
      out.push({ from: e.data[0]!, to: e.data[1]!, amount: joinU256(e.data[2]!, e.data[3]!) });
    }
  }
  return out;
}
