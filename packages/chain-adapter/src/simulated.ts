import { randomBytes } from 'node:crypto';
import { OFFCHAIN_ONLY_DISCLOSURES, type Asset, type PaymentVerification } from '@veyra/core';
import {
  ChainAdapterError,
  type BatchPlan,
  type ChainAdapter,
  type ChainCapabilities,
  type SignedTransaction,
  type TransactionRef,
  type TransactionStatus,
  type UnsignedTransaction,
  type VerificationResult,
} from './types';

/**
 * In-memory ledger for local development, demos and tests. It never touches a
 * real network. Every transaction and receipt it produces is labelled
 * "simulated". State resets when the process restarts.
 */

interface SimulatedTransfer {
  from: string;
  to: string;
  asset: string;
  amount: bigint;
}

interface SimulatedTx {
  hash: string;
  kind: SignedTransaction['kind'];
  chainBatchId: string;
  status: 'FINALISED' | 'REVERTED';
  error: string | null;
  transfers: SimulatedTransfer[];
  blockNumber: number;
}

export interface SimulatedAdapterOptions {
  network?: string;
  /** Opening balance (base units) for any account the ledger has not seen. */
  defaultBalance?: bigint;
  maxBatchSize?: number;
}

const ADDRESS_RE = /^sim:[a-z0-9][a-z0-9._-]{0,62}$|^0x[0-9a-f]{1,64}$/;

export class SimulatedLedger {
  private readonly balances = new Map<string, bigint>();
  private readonly txs = new Map<string, SimulatedTx>();
  private readonly executedBatches = new Set<string>();
  private block = 0;

  constructor(private readonly defaultBalance: bigint) {}

  private key(account: string, asset: string) {
    return `${asset}|${account}`;
  }

  balanceOf(account: string, asset: string): bigint {
    return this.balances.get(this.key(account, asset)) ?? this.defaultBalance;
  }

  setBalance(account: string, asset: string, amount: bigint) {
    this.balances.set(this.key(account, asset), amount);
  }

  execute(plan: BatchPlan, from: string): SimulatedTx {
    const hash = `0x${randomBytes(32).toString('hex')}`;
    this.block += 1;
    const asset = plan.asset.address;
    const base = { hash, kind: 'execute' as const, chainBatchId: plan.chainBatchId, blockNumber: this.block };
    if (this.executedBatches.has(plan.chainBatchId)) {
      const tx: SimulatedTx = { ...base, status: 'REVERTED', error: 'Batch already executed', transfers: [] };
      this.txs.set(hash, tx);
      return tx;
    }
    const balance = this.balanceOf(from, asset);
    if (balance < plan.total) {
      const tx: SimulatedTx = { ...base, status: 'REVERTED', error: 'Insufficient treasury balance', transfers: [] };
      this.txs.set(hash, tx);
      return tx;
    }
    // Atomic: all transfers apply or none do.
    this.setBalance(from, asset, balance - plan.total);
    const transfers = plan.items.map((i) => {
      this.setBalance(i.recipient, asset, this.balanceOf(i.recipient, asset) + i.amount);
      return { from, to: i.recipient, asset, amount: i.amount };
    });
    this.executedBatches.add(plan.chainBatchId);
    const tx: SimulatedTx = { ...base, status: 'FINALISED', error: null, transfers };
    this.txs.set(hash, tx);
    return tx;
  }

  get(hash: string): SimulatedTx | undefined {
    return this.txs.get(hash);
  }
}

export class SimulatedAdapter implements ChainAdapter {
  readonly ledger: SimulatedLedger;
  private readonly network: string;
  private readonly maxBatchSize: number;

  constructor(opts: SimulatedAdapterOptions = {}) {
    this.network = opts.network ?? 'local';
    this.maxBatchSize = opts.maxBatchSize ?? 200;
    this.ledger = new SimulatedLedger(opts.defaultBalance ?? 1_000_000n * 10n ** 6n);
  }

  getCapabilities(): ChainCapabilities {
    return {
      chain: 'simulated',
      network: this.network,
      executionMode: 'simulated',
      onChainApprovals: false,
      requiresProposal: false,
      signing: 'server-simulated',
      maxBatchSize: this.maxBatchSize,
      finality: 'Immediate (simulated ledger, no real funds)',
      verifiableAmounts: true,
      privacy: {
        label: 'Simulated – no real network',
        shieldedTransfers: false,
        maturity: 'simulated',
        visibility: {
          recipientAddresses: 'not-stored',
          amounts: 'not-stored',
          contractorIdentity: 'encrypted-offchain',
          batchTotal: 'not-stored',
          timing: 'not-stored',
          approvals: 'not-stored',
        },
        disclosures: [
          'Simulated mode moves no real funds and publishes nothing on a blockchain.',
          ...OFFCHAIN_ONLY_DISCLOSURES,
        ],
      },
    };
  }

  isValidAddress(address: string): boolean {
    return ADDRESS_RE.test(address.trim().toLowerCase());
  }

  normaliseAddress(address: string): string {
    const a = address.trim().toLowerCase();
    if (!this.isValidAddress(a)) throw new ChainAdapterError('INVALID_ADDRESS', `Invalid simulated address ${address}`);
    return a;
  }

  async getBalance(account: string, asset: Asset): Promise<bigint> {
    return this.ledger.balanceOf(this.normaliseAddress(account), asset.address);
  }

  computeItemsHash(): string | null {
    return null;
  }

  buildProposal(): UnsignedTransaction | null {
    return null;
  }

  buildApproval(): UnsignedTransaction | null {
    return null;
  }

  createPayment(plan: BatchPlan): UnsignedTransaction {
    this.assertPlan(plan);
    return {
      chain: 'simulated',
      network: this.network,
      kind: 'execute',
      description: `Simulated payout of ${plan.items.length} payments`,
      calls: [],
    };
  }

  buildCancellation(): UnsignedTransaction | null {
    return null;
  }

  async submitTransaction(tx: SignedTransaction): Promise<TransactionRef> {
    if (tx.kind !== 'execute') throw new ChainAdapterError('UNSUPPORTED', `Simulated chain has no ${tx.kind} transaction`);
    this.assertPlan(tx.plan);
    const from = this.normaliseAddress(tx.plan.treasuryAddress ?? '');
    const result = this.ledger.execute(tx.plan, from);
    return { chain: 'simulated', network: this.network, txHash: result.hash };
  }

  async getTransaction(ref: TransactionRef): Promise<TransactionStatus> {
    const tx = this.ledger.get(ref.txHash);
    if (!tx) return { ref, state: 'NOT_FOUND', blockNumber: null, error: null };
    return { ref, state: tx.status, blockNumber: tx.blockNumber, error: tx.error };
  }

  async verifyProposal(): Promise<VerificationResult> {
    return { verified: true, details: ['Simulated chain does not use on-chain proposals'], mismatches: [] };
  }

  async verifyApproval(): Promise<VerificationResult> {
    return { verified: true, details: ['Simulated chain enforces approvals in the Veyra API'], mismatches: [] };
  }

  async verifyPayment(ref: TransactionRef, plan: BatchPlan): Promise<PaymentVerification> {
    const tx = this.ledger.get(ref.txHash);
    const checkedAt = new Date().toISOString();
    if (!tx) return { verified: false, method: 'simulated', checkedAt, details: [], mismatches: ['Transaction not found'] };
    const mismatches: string[] = [];
    if (tx.status !== 'FINALISED') mismatches.push(`Transaction ${tx.status}: ${tx.error ?? 'unknown error'}`);
    if (tx.chainBatchId !== plan.chainBatchId) mismatches.push('Transaction belongs to a different batch');
    mismatches.push(...compareTransfers(plan, tx.transfers));
    return {
      verified: mismatches.length === 0,
      method: 'simulated',
      checkedAt,
      details: [`${tx.transfers.length} simulated transfers in block ${tx.blockNumber}`],
      mismatches,
    };
  }

  private assertPlan(plan: BatchPlan) {
    if (plan.items.length > this.maxBatchSize) {
      throw new ChainAdapterError('BATCH_TOO_LARGE', `Batch exceeds ${this.maxBatchSize} payments`);
    }
    if (!plan.treasuryAddress) throw new ChainAdapterError('MISCONFIGURED', 'Treasury address is not configured');
  }
}

/** Compare expected payments with observed transfers (multiset match). */
export function compareTransfers(plan: BatchPlan, observed: readonly { to: string; amount: bigint }[]): string[] {
  const mismatches: string[] = [];
  const remaining = observed.map((t) => ({ to: t.to.toLowerCase(), amount: t.amount, used: false }));
  for (const item of plan.items) {
    const match = remaining.find((t) => !t.used && t.to === item.recipient.toLowerCase() && t.amount === item.amount);
    if (match) match.used = true;
    else mismatches.push(`Missing transfer of ${item.amount} to ${item.recipient}`);
  }
  for (const extra of remaining.filter((t) => !t.used)) {
    mismatches.push(`Unexpected transfer of ${extra.amount} to ${extra.to}`);
  }
  return mismatches;
}
