import { describe, expect, it } from 'vitest';
import { num } from 'starknet';
import type { BatchPlan } from '@veyra/chain-adapter';
import {
  StarknetStrk20Adapter,
  StarknetVaultAdapter,
  StarknetWalletAdapter,
  computeItemsHash,
  createStarknetAdapter,
  decodeBatch,
  executeCall,
  selector,
  splitU256,
  type StarknetRpc,
} from '../src';

const VAULT = '0x0abc';
const TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
const BATCH = '0x0f8e2c4a1b3d4e5f8a9b0c1d2e3f4a5b';

const plan: BatchPlan = {
  chainBatchId: BATCH,
  asset: { address: TOKEN, symbol: 'USDC', decimals: 6 },
  treasuryAddress: VAULT,
  items: [
    { recipient: '0x123', amount: 1_000_000n },
    { recipient: '0x456', amount: 5n + (1n << 128n) },
  ],
  total: 1_000_005n + (1n << 128n),
};

type Ev = { from_address: string; keys: string[]; data: string[] };
const h = (v: bigint | number | string) => num.toHex(v);

function rpc(overrides: Partial<StarknetRpc> & { receipt?: unknown; sender?: string; calls?: Record<string, string[]> } = {}): StarknetRpc {
  return {
    callContract: async (call) => {
      const r = overrides.calls?.[call.entrypoint];
      if (!r) throw new Error(`entrypoint ${call.entrypoint} not found`);
      return r;
    },
    getTransactionReceipt: async () => {
      if (!overrides.receipt) throw new Error('Transaction hash not found');
      return overrides.receipt;
    },
    getTransactionByHash: async () => ({ sender_address: overrides.sender }),
    getTransactionStatus: async () => {
      throw new Error('Transaction hash not found');
    },
    ...overrides,
  };
}

function executionEvents(p: BatchPlan, tamper = false): Ev[] {
  const events: Ev[] = [];
  p.items.forEach((item, i) => {
    const amount = tamper && i === 0 ? item.amount + 1n : item.amount;
    const [lo, hi] = splitU256(amount);
    events.push({ from_address: TOKEN, keys: [selector('Transfer'), VAULT, item.recipient], data: [lo, hi] });
    events.push({ from_address: VAULT, keys: [selector('PaymentSent'), BATCH, item.recipient], data: [lo, hi] });
  });
  const [lo, hi] = splitU256(p.total);
  events.push({ from_address: VAULT, keys: [selector('BatchExecuted'), BATCH], data: ['0x999', TOKEN, lo, hi, h(p.items.length)] });
  return events;
}

const ok = (events: Ev[]) => ({ execution_status: 'SUCCEEDED', finality_status: 'ACCEPTED_ON_L2', block_number: 7, events });
const ref = { chain: 'starknet' as const, network: 'sepolia', txHash: '0x1' };

describe('encoding', () => {
  it('matches the Cairo items hash vector', () => {
    // Same vector as test_items_hash_vector in test_payroll_vault.cairo.
    expect(computeItemsHash(BATCH, TOKEN, plan.items)).toBe('0x73961680fa988d659b310e4f8c554fd23044994b55bbd9700257f2994a44fe6');
  });

  it('serialises execute_batch calldata as two spans', () => {
    const call = executeCall(VAULT, plan);
    expect(call.entrypoint).toBe('execute_batch');
    expect(call.calldata).toEqual([h(BATCH), '0x2', '0x123', '0x456', '0x2', '0xf4240', '0x0', '0x5', '0x1']);
  });

  it('decodes get_batch output', () => {
    const b = decodeBatch([TOKEN, '0x10', '0x0', '0x2', '0xabc', '0x1', '0x1', '0x777', '0x0']);
    expect(b).toMatchObject({ total: 16n, itemCount: 2, approvals: 1, status: 'Proposed' });
  });

  it('rejects out-of-range u256', () => {
    expect(() => splitU256(-1n)).toThrow(RangeError);
    expect(() => splitU256(1n << 256n)).toThrow(RangeError);
  });
});

describe('StarknetVaultAdapter', () => {
  it('validates and normalises addresses', () => {
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc() });
    expect(a.isValidAddress('0x123')).toBe(true);
    expect(a.isValidAddress('0x0')).toBe(false);
    expect(a.isValidAddress('hello')).toBe(false);
    expect(a.normaliseAddress('0x123')).toBe(`0x${'0'.repeat(61)}123`);
  });

  it('builds proposal, approval and execution calls against the vault', () => {
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc() });
    const proposal = a.buildProposal(plan);
    expect(proposal.calls[0]!.entrypoint).toBe('propose_batch');
    expect(proposal.calls[0]!.calldata.at(-1)).toBe(a.computeItemsHash(plan));
    expect(a.buildApproval(plan).calls[0]!.calldata).toEqual([h(BATCH)]);
    expect(a.createPayment(plan).kind).toBe('execute');
    expect(() => a.createPayment({ ...plan, treasuryAddress: null })).toThrow(/Treasury/);
  });

  it('refuses server-side submission', async () => {
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc() });
    await expect(a.submitTransaction({ kind: 'execute', plan })).rejects.toThrow(/wallet/);
  });

  it('reads token balances', async () => {
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ calls: { balance_of: ['0x5', '0x1'] } }) });
    expect(await a.getBalance(VAULT, plan.asset)).toBe(5n + (1n << 128n));
  });

  it('maps transaction states', async () => {
    const reverted = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: { execution_status: 'REVERTED', revert_reason: 'Vault: threshold not met' } }) });
    expect(await reverted.getTransaction(ref)).toMatchObject({ state: 'REVERTED', error: 'Vault: threshold not met' });
    const l2 = { execution_status: 'SUCCEEDED', finality_status: 'ACCEPTED_ON_L2' };
    expect((await new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: l2 }) }).getTransaction(ref)).state).toBe('FINALISED');
    expect((await new StarknetVaultAdapter({ network: 'sepolia', finality: 'L1', rpc: rpc({ receipt: l2 }) }).getTransaction(ref)).state).toBe('ACCEPTED');
    expect((await new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc() }).getTransaction(ref)).state).toBe('NOT_FOUND');
    const pending = rpc({ getTransactionStatus: async () => ({ finality_status: 'RECEIVED' }) });
    expect((await new StarknetVaultAdapter({ network: 'sepolia', rpc: pending }).getTransaction(ref)).state).toBe('PENDING');
  });

  it('verifies an execution against vault and token events', async () => {
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok(executionEvents(plan)) }) });
    const v = await a.verifyPayment(ref, plan);
    expect(v.mismatches).toEqual([]);
    expect(v.verified).toBe(true);
    expect(v.method).toBe('onchain-events');
  });

  it('matches padded and unpadded addresses', async () => {
    const padded = { ...plan, items: plan.items.map((i) => ({ ...i, recipient: `0x${BigInt(i.recipient).toString(16).padStart(64, '0')}` })) };
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok(executionEvents(plan)) }) });
    expect((await a.verifyPayment(ref, padded)).mismatches).toEqual([]);
  });

  it('flags a tampered amount', async () => {
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok(executionEvents(plan, true)) }) });
    const v = await a.verifyPayment(ref, plan);
    expect(v.verified).toBe(false);
    expect(v.mismatches.some((m) => m.startsWith('Token event'))).toBe(true);
  });

  it('flags a missing execution event', async () => {
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok([]) }) });
    expect((await a.verifyPayment(ref, plan)).mismatches[0]).toMatch(/BatchExecuted/);
  });

  it('verifies a proposal', async () => {
    const a0 = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc() });
    const [lo, hi] = splitU256(plan.total);
    const ev: Ev = { from_address: VAULT, keys: [selector('BatchProposed'), BATCH], data: ['0x777', TOKEN, lo, hi, '0x2', a0.computeItemsHash(plan)] };
    const a = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok([ev]) }) });
    expect((await a.verifyProposal(ref, plan)).verified).toBe(true);
    const bad = { ...plan, items: [plan.items[1]!, plan.items[0]!] };
    expect((await a.verifyProposal(ref, bad)).mismatches).toContain('On-chain items hash differs from the batch');
  });

  it('verifies an approval and detects revocation', async () => {
    const ev: Ev = { from_address: VAULT, keys: [selector('BatchApproved'), BATCH, '0x777'], data: ['0x1'] };
    const approved = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok([ev]), calls: { has_approved: ['0x1'] } }) });
    expect((await approved.verifyApproval(ref, plan, '0x777')).verified).toBe(true);
    expect((await approved.verifyApproval(ref, plan, '0x888')).verified).toBe(false);
    const revoked = new StarknetVaultAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok([ev]), calls: { has_approved: ['0x0'] } }) });
    expect((await revoked.verifyApproval(ref, plan, '0x777')).mismatches).toEqual(['Approval was revoked on-chain']);
  });

  it('requires an RPC', () => {
    expect(() => new StarknetVaultAdapter({ network: 'sepolia' })).toThrow(/RPC/);
  });
});

describe('StarknetStrk20Adapter', () => {
  it('declares experimental shielded transfers with API-enforced approvals', () => {
    const caps = new StarknetStrk20Adapter({ network: 'sepolia', rpc: rpc() }).getCapabilities();
    expect(caps).toMatchObject({ executionMode: 'strk20-private', onChainApprovals: false, verifiableAmounts: false });
    expect(caps.privacy).toMatchObject({ shieldedTransfers: true, maturity: 'experimental' });
    expect(caps.privacy.disclosures.join(' ')).toMatch(/Deposits/);
  });

  it('builds STRK20 transfer actions', () => {
    const tx = new StarknetStrk20Adapter({ network: 'sepolia', rpc: rpc() }).createPayment(plan);
    const actions = tx.extra?.strk20Actions as { type: string; amount: string }[];
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ type: 'transfer', amount: '0xf4240' });
    expect(() => new StarknetStrk20Adapter({ network: 'devnet', rpc: rpc() }).createPayment(plan)).toThrow(/not available/);
  });

  it('verifies only that the payer transaction succeeded', async () => {
    const good = new StarknetStrk20Adapter({ network: 'sepolia', rpc: rpc({ receipt: ok([]), sender: VAULT }) });
    const v = await good.verifyPayment(ref, plan);
    expect(v).toMatchObject({ verified: true, method: 'transaction-status' });
    const other = new StarknetStrk20Adapter({ network: 'sepolia', rpc: rpc({ receipt: ok([]), sender: '0x999' }) });
    expect((await other.verifyPayment(ref, plan)).verified).toBe(false);
  });

  it('does not report shielded balances', async () => {
    await expect(new StarknetStrk20Adapter({ network: 'sepolia', rpc: rpc() }).getBalance()).rejects.toThrow(/payer wallet/);
  });
});

describe('createStarknetAdapter', () => {
  it('selects by execution mode', () => {
    expect(createStarknetAdapter('vault', { network: 'sepolia', rpc: rpc() })).toBeInstanceOf(StarknetVaultAdapter);
    expect(createStarknetAdapter('strk20-private', { network: 'sepolia', rpc: rpc() })).toBeInstanceOf(StarknetStrk20Adapter);
    expect(() => createStarknetAdapter('simulated', { network: 'sepolia', rpc: rpc() })).toThrow(/does not support/);
  });
});

describe('StarknetWalletAdapter', () => {
  const PAYER = '0x0777';
  const walletPlan: BatchPlan = { ...plan, treasuryAddress: PAYER };
  const transfers = (p: BatchPlan, from = PAYER, tamper = false): Ev[] =>
    p.items.map((item, i) => {
      const [lo, hi] = splitU256(tamper && i === 0 ? item.amount + 1n : item.amount);
      return { from_address: TOKEN, keys: [selector('Transfer'), from, item.recipient], data: [lo, hi] };
    });

  it('pays from the account with API-enforced approvals and no proposal', () => {
    const caps = new StarknetWalletAdapter({ network: 'sepolia', rpc: rpc() }).getCapabilities();
    expect(caps).toMatchObject({ executionMode: 'wallet', onChainApprovals: false, requiresProposal: false, verifiableAmounts: true });
    expect(createStarknetAdapter('wallet', { network: 'sepolia', rpc: rpc() })).toBeInstanceOf(StarknetWalletAdapter);
  });

  it('builds one ERC-20 transfer per payment and names the payer', () => {
    const tx = new StarknetWalletAdapter({ network: 'sepolia', rpc: rpc() }).createPayment(walletPlan);
    expect(tx.calls).toHaveLength(2);
    expect(tx.calls[1]).toEqual({
      contractAddress: num.toHex64(TOKEN),
      entrypoint: 'transfer',
      calldata: [num.toHex64('0x456'), ...splitU256(5n + (1n << 128n))],
    });
    expect(tx.extra).toEqual({ payer: num.toHex64(PAYER) });
  });

  it('refuses a batch without a paying account', () => {
    expect(() => new StarknetWalletAdapter({ network: 'sepolia', rpc: rpc() }).createPayment({ ...plan, treasuryAddress: null })).toThrow(/Treasury/);
  });

  it('verifies transfers sent by the paying account', async () => {
    const a = new StarknetWalletAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok(transfers(walletPlan)), sender: PAYER }) });
    const v = await a.verifyPayment(ref, walletPlan);
    expect(v.mismatches).toEqual([]);
    expect(v.verified).toBe(true);
  });

  it('rejects a payment sent from another account or with a changed amount', async () => {
    const other = new StarknetWalletAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok(transfers(walletPlan, '0x0999')), sender: '0x0999' }) });
    const v1 = await other.verifyPayment(ref, walletPlan);
    expect(v1.verified).toBe(false);
    expect(v1.mismatches).toContain('Transaction was not sent by the paying account');

    const tampered = new StarknetWalletAdapter({ network: 'sepolia', rpc: rpc({ receipt: ok(transfers(walletPlan, PAYER, true)), sender: PAYER }) });
    expect((await tampered.verifyPayment(ref, walletPlan)).verified).toBe(false);
  });
});
