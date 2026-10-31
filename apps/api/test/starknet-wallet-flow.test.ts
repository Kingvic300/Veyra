import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StarknetWalletAdapter, selector, splitU256, type StarknetRpc } from '@veyra/starknet-adapter';
import { ChainService } from '../src/chain/chain.service.js';
import { Client, createTestApp, expectStatus, resetDatabase, type TestApp } from './helpers.js';

const pad = (n: string) => `0x${n.padStart(64, '0')}`;
const PAYER = pad('beef');
const STRANGER = pad('dead');
const TOKEN = pad('70c3');
const PAYEES = [pad('c001'), pad('c002')];
const AMOUNTS = [1_200_000_000n, 800_500_000n];

type Ev = { from_address: string; keys: string[]; data: string[] };

class FakeStarknet implements StarknetRpc {
  receipts = new Map<string, unknown>();
  senders = new Map<string, string>();
  async callContract(call: { entrypoint: string }) {
    if (call.entrypoint === 'balance_of' || call.entrypoint === 'balanceOf') return splitU256(10_000_000_000n);
    throw new Error(`unexpected call ${call.entrypoint}`);
  }
  async getTransactionReceipt(hash: string) {
    const r = this.receipts.get(hash);
    if (!r) throw new Error('Transaction hash not found');
    return r;
  }
  async getTransactionByHash(hash: string) {
    return { sender_address: this.senders.get(hash) };
  }
  async getTransactionStatus(): Promise<unknown> {
    throw new Error('Transaction hash not found');
  }
  paid(hash: string, from: string) {
    const events: Ev[] = PAYEES.map((to, i) => {
      const [lo, hi] = splitU256(AMOUNTS[i]!);
      return { from_address: TOKEN, keys: [selector('Transfer'), from, to], data: [lo, hi] };
    });
    this.senders.set(hash, from);
    this.receipts.set(hash, { execution_status: 'SUCCEEDED', finality_status: 'ACCEPTED_ON_L2', block_number: 9, events });
  }
}

let t: TestApp;
const rpc = new FakeStarknet();
let owner: Client;
let ap1: Client;
let ap2: Client;
let orgId = '';
let batchId = '';
const base = () => `/organisations/${orgId}/batches/${batchId}`;

beforeAll(async () => {
  await resetDatabase();
  t = await createTestApp();
  t.app.get(ChainService).registry.register('starknet', () => new StarknetWalletAdapter({ network: 'devnet', rpc }));
  owner = await new Client(t, 'owner@wallet.dev').register('Owner');
  ap1 = await new Client(t, 'ap1@wallet.dev').register('Approver One');
  ap2 = await new Client(t, 'ap2@wallet.dev').register('Approver Two');
});

afterAll(async () => {
  await t?.app.close();
});

describe('Starknet pay-from-wallet flow', () => {
  it('sets up an organisation that pays from its own account', async () => {
    const org = await owner.post('/organisations', {
      name: 'Wallet Studio',
      chain: 'starknet',
      network: 'devnet',
      executionMode: 'wallet',
      treasuryAddress: PAYER,
      asset: { address: TOKEN, symbol: 'USDC', decimals: 6 },
      approvalPolicy: { threshold: 2, allowCreatorApproval: false, maxBatchTotal: null },
    });
    expectStatus(org, 201);
    orgId = org.body.id;
    expectStatus(await owner.post(`/organisations/${orgId}/members`, { email: ap1.email, role: 'APPROVER' }), 201);
    expectStatus(await owner.post(`/organisations/${orgId}/members`, { email: ap2.email, role: 'APPROVER' }), 201);
    const caps = await owner.get(`/organisations/${orgId}/capabilities`);
    expect(caps.body).toMatchObject({ executionMode: 'wallet', onChainApprovals: false, requiresProposal: false, signing: 'browser-wallet' });
  });

  it('approves in Veyra without any on-chain step', async () => {
    const ids: string[] = [];
    for (const [i, payee] of PAYEES.entries()) {
      ids.push((await owner.post(`/organisations/${orgId}/contractors`, { name: `Dev ${i}`, payoutAddress: payee })).body.id);
    }
    const batch = await owner.post(`/organisations/${orgId}/batches`, {
      title: 'October',
      items: [
        { contractorId: ids[0], amount: '1200' },
        { contractorId: ids[1], amount: '800.5' },
      ],
    });
    batchId = batch.body.id;
    expectStatus(await owner.post(`${base()}/submit`), 200);
    expectStatus(await ap1.post(`${base()}/approvals`, {}), 200);
    expectStatus(await ap2.post(`${base()}/approvals`, {}), 200);
    expect((await owner.get(base())).body.status).toBe('APPROVED');
  });

  it('hands the wallet one transfer per payment and names the paying account', async () => {
    const action = await owner.get(`${base()}/chain-actions/execute`);
    expectStatus(action, 200);
    expect(action.body.calls).toHaveLength(2);
    expect(action.body.calls.map((c: { entrypoint: string }) => c.entrypoint)).toEqual(['transfer', 'transfer']);
    expect(BigInt(action.body.calls[0].calldata[0])).toBe(BigInt(PAYEES[0]!));
    expect(BigInt(action.body.extra.payer)).toBe(BigInt(PAYER));
  });

  it('fails a payment sent from another account, then completes when the paying account sends it', async () => {
    rpc.paid('0xbad', STRANGER);
    await owner.post(`${base()}/execute`, { txHash: '0xbad' });
    await t.monitor.idle();
    let b = await owner.get(base());
    expect(b.body.status).toBe('FAILED');
    expect(b.body.executions[0].error).toMatch(/Verification failed/);

    rpc.paid('0x600d', PAYER);
    expectStatus(await owner.post(`${base()}/execute`, { txHash: '0x600d' }), 200);
    await t.monitor.idle();
    b = await owner.get(base());
    expect(b.body.status).toBe('COMPLETED');
    expect(b.body.executions[1].verification).toMatchObject({ verified: true, method: 'onchain-events' });
  });
});
