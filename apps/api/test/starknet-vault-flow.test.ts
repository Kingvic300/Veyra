import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StarknetVaultAdapter, selector, splitU256, type StarknetRpc } from '@veyra/starknet-adapter';
import { ChainService } from '../src/chain/chain.service.js';
import { Client, createTestApp, expectStatus, resetDatabase, type TestApp } from './helpers.js';

const pad = (n: string) => `0x${n.padStart(64, '0')}`;
const VAULT = pad('a11a');
const TOKEN = pad('70c3');
const WALLET1 = pad('1001');
const WALLET2 = pad('1002');
const PAYEES = [pad('c001'), pad('c002')];

type Ev = { from_address: string; keys: string[]; data: string[] };

/** Programmable stand-in for a Starknet JSON-RPC node. */
class FakeStarknet implements StarknetRpc {
  receipts = new Map<string, unknown>();
  /** Calls to getTransactionReceipt that report "not found" before the receipt appears. */
  delays = new Map<string, number>();
  approved = new Set<string>();
  vaultBalance = 10_000_000_000n;

  async callContract(call: { contractAddress: string; entrypoint: string; calldata: string[] }) {
    if (call.entrypoint === 'balance_of') return splitU256(this.vaultBalance);
    if (call.entrypoint === 'has_approved') return [this.approved.has(BigInt(call.calldata[1]!).toString()) ? '0x1' : '0x0'];
    throw new Error(`unexpected call ${call.entrypoint}`);
  }
  async getTransactionReceipt(hash: string) {
    const wait = this.delays.get(hash) ?? 0;
    if (wait > 0) {
      this.delays.set(hash, wait - 1);
      throw new Error('Transaction hash not found');
    }
    const r = this.receipts.get(hash);
    if (!r) throw new Error('Transaction hash not found');
    return r;
  }
  async getTransactionByHash() {
    return {};
  }
  async getTransactionStatus(): Promise<unknown> {
    throw new Error('Transaction hash not found');
  }
  ok(hash: string, events: Ev[]) {
    this.receipts.set(hash, { execution_status: 'SUCCEEDED', finality_status: 'ACCEPTED_ON_L2', block_number: 42, events });
  }
  reverted(hash: string, reason: string) {
    this.receipts.set(hash, { execution_status: 'REVERTED', finality_status: 'ACCEPTED_ON_L2', revert_reason: reason, events: [] });
  }
}

let t: TestApp;
const rpc = new FakeStarknet();
let owner: Client;
let ap1: Client;
let ap2: Client;
let orgId = '';
let batchId = '';
let chainBatchId = '';
let itemsHash = '';
const base = () => `/organisations/${orgId}/batches/${batchId}`;

beforeAll(async () => {
  await resetDatabase();
  t = await createTestApp();
  t.app.get(ChainService).registry.register('starknet', () => new StarknetVaultAdapter({ network: 'devnet', rpc }));
  owner = await new Client(t, 'owner@studio.dev').register('Owner');
  ap1 = await new Client(t, 'ap1@studio.dev').register('Approver One');
  ap2 = await new Client(t, 'ap2@studio.dev').register('Approver Two');
});

afterAll(async () => {
  await t?.app.close();
});

describe('Starknet PayrollVault flow', () => {
  it('sets up an organisation with on-chain approvals', async () => {
    const org = await owner.post('/organisations', {
      name: 'Lagos Dev Studio',
      chain: 'starknet',
      network: 'devnet',
      executionMode: 'vault',
      treasuryAddress: VAULT,
      asset: { address: TOKEN, symbol: 'USDC', decimals: 6 },
      approvalPolicy: { threshold: 2, allowCreatorApproval: false, maxBatchTotal: null },
    });
    expectStatus(org, 201);
    orgId = org.body.id;
    expectStatus(await owner.post(`/organisations/${orgId}/members`, { email: ap1.email, role: 'APPROVER', walletAddress: WALLET1 }), 201);
    expectStatus(await owner.post(`/organisations/${orgId}/members`, { email: ap2.email, role: 'APPROVER', walletAddress: WALLET2 }), 201);
    const caps = await owner.get(`/organisations/${orgId}/capabilities`);
    expect(caps.body).toMatchObject({ onChainApprovals: true, requiresProposal: true, signing: 'browser-wallet' });
    expect(caps.body.privacy.label).toBe('Transparent on-chain');
  });

  it('creates and submits a batch', async () => {
    const ids: string[] = [];
    for (const [i, payee] of PAYEES.entries()) {
      const c = await owner.post(`/organisations/${orgId}/contractors`, { name: `Dev ${i}`, payoutAddress: payee });
      ids.push(c.body.id);
    }
    const batch = await owner.post(`/organisations/${orgId}/batches`, {
      title: 'Sprint 42',
      items: [
        { contractorId: ids[0], amount: '1200' },
        { contractorId: ids[1], amount: '800.5' },
      ],
    });
    batchId = batch.body.id;
    const submitted = await owner.post(`${base()}/submit`);
    expectStatus(submitted, 200);
    expect(submitted.body.proposal.status).toBe('NONE');
    chainBatchId = submitted.body.chainBatchId;
    itemsHash = submitted.body.chainItemsHash;
    expect(itemsHash).toMatch(/^0x[0-9a-f]+$/);
  });

  it('requires the on-chain proposal before approvals', async () => {
    const res = await ap1.post(`${base()}/approvals`, { txHash: '0xa1' });
    expect(res.body.error.code).toBe('PROPOSAL_PENDING');
  });

  it('builds the propose call for the wallet', async () => {
    const action = await owner.get(`${base()}/chain-actions/propose`);
    expect(action.body.calls[0]).toMatchObject({ contractAddress: VAULT, entrypoint: 'propose_batch' });
    expect(action.body.calls[0].calldata.at(-1)).toBe(itemsHash);
  });

  it('confirms the proposal once the transaction is final', async () => {
    const [lo, hi] = splitU256(2_000_500_000n);
    rpc.delays.set('0xf1', 2);
    rpc.ok('0xf1', [{ from_address: VAULT, keys: [selector('BatchProposed'), chainBatchId], data: [WALLET1, TOKEN, lo, hi, '0x2', itemsHash] }]);
    const res = await owner.post(`${base()}/proposal`, { txHash: '0xf1' });
    expectStatus(res, 200);
    expect(res.body.proposal.status).toBe('PENDING');
    await t.monitor.idle();
    expect((await owner.get(base())).body.proposal.status).toBe('CONFIRMED');
  });

  it('requires a wallet transaction for approvals', async () => {
    expect((await ap1.post(`${base()}/approvals`, {})).body.error.code).toBe('TX_REQUIRED');
  });

  it('confirms a verified on-chain approval', async () => {
    rpc.ok('0xa1', [{ from_address: VAULT, keys: [selector('BatchApproved'), chainBatchId, WALLET1], data: ['0x1'] }]);
    rpc.approved.add(BigInt(WALLET1).toString());
    await ap1.post(`${base()}/approvals`, { txHash: '0xa1' });
    await t.monitor.idle();
    const b = await owner.get(base());
    expect(b.body.approvalSummary).toMatchObject({ confirmed: 1, pending: 0 });
  });

  it('marks a reverted approval failed and allows a retry', async () => {
    rpc.reverted('0xa2', 'Vault: caller not approver');
    await ap2.post(`${base()}/approvals`, { txHash: '0xa2' });
    await t.monitor.idle();
    let b = await owner.get(base());
    expect(b.body.approvals.find((a: { txHash: string }) => a.txHash === '0xa2').status).toBe('FAILED');
    expect(b.body.status).toBe('PENDING_APPROVAL');

    rpc.ok('0xa3', [{ from_address: VAULT, keys: [selector('BatchApproved'), chainBatchId, WALLET2], data: ['0x2'] }]);
    rpc.approved.add(BigInt(WALLET2).toString());
    await ap2.post(`${base()}/approvals`, { txHash: '0xa3' });
    await t.monitor.idle();
    b = await owner.get(base());
    expect(b.body.status).toBe('APPROVED');
  });

  it('rejects an approval transaction signed by a different wallet', async () => {
    // ap1 tries to reuse ap2's transaction on a fresh batch: verification must fail.
    const ids = (await owner.get(`/organisations/${orgId}/contractors`)).body.map((c: { id: string }) => c.id);
    const other = await owner.post(`/organisations/${orgId}/batches`, { title: 'Other', items: [{ contractorId: ids[0], amount: '1' }] });
    const otherBase = `/organisations/${orgId}/batches/${other.body.id}`;
    const sub = await owner.post(`${otherBase}/submit`);
    const [lo, hi] = splitU256(1_000_000n);
    rpc.ok('0xf2', [{ from_address: VAULT, keys: [selector('BatchProposed'), sub.body.chainBatchId], data: [WALLET1, TOKEN, lo, hi, '0x1', sub.body.chainItemsHash] }]);
    await owner.post(`${otherBase}/proposal`, { txHash: '0xf2' });
    await t.monitor.idle();
    await ap1.post(`${otherBase}/approvals`, { txHash: '0xa3' });
    await t.monitor.idle();
    const b = await owner.get(otherBase);
    expect(b.body.approvals[0].status).toBe('FAILED');
  });

  it('builds execute calldata with the frozen items', async () => {
    const action = await owner.get(`${base()}/chain-actions/execute`);
    const calldata: string[] = action.body.calls[0].calldata;
    expect(action.body.calls[0].entrypoint).toBe('execute_batch');
    expect(calldata.slice(1, 4).map((x) => BigInt(x))).toEqual([2n, BigInt(PAYEES[0]!), BigInt(PAYEES[1]!)]);
  });

  it('fails an execution whose transaction does not pay this batch, then succeeds on retry', async () => {
    rpc.ok('0xe1', []);
    await owner.post(`${base()}/execute`, { txHash: '0xe1' });
    await t.monitor.idle();
    let b = await owner.get(base());
    expect(b.body.status).toBe('FAILED');
    expect(b.body.executions[0].error).toMatch(/Verification failed/);

    const events: Ev[] = [];
    const amounts = [1_200_000_000n, 800_500_000n];
    PAYEES.forEach((payee, i) => {
      const [lo, hi] = splitU256(amounts[i]!);
      events.push({ from_address: TOKEN, keys: [selector('Transfer'), VAULT, payee], data: [lo, hi] });
      events.push({ from_address: VAULT, keys: [selector('PaymentSent'), chainBatchId, payee], data: [lo, hi] });
    });
    const [lo, hi] = splitU256(2_000_500_000n);
    events.push({ from_address: VAULT, keys: [selector('BatchExecuted'), chainBatchId], data: [WALLET1, TOKEN, lo, hi, '0x2'] });
    rpc.ok('0xe2', events);
    const retry = await owner.post(`${base()}/execute`, { txHash: '0xe2' });
    expectStatus(retry, 200);
    await t.monitor.idle();
    b = await owner.get(base());
    expect(b.body.executions[1]?.error ?? null).toBeNull();
    expect(b.body.status).toBe('COMPLETED');
    expect(b.body.executions).toHaveLength(2);
    expect(b.body.executions[1].verification).toMatchObject({ verified: true, method: 'onchain-events' });
  });

  it('rejects reusing an execution transaction hash', async () => {
    const res = await owner.post(`${base()}/execute`, { txHash: '0xe2' });
    expect(res.status).toBe(409);
  });

  it('keeps a verifiable audit chain', async () => {
    expect((await owner.get(`/organisations/${orgId}/audit/verify`)).body.valid).toBe(true);
  });
});
