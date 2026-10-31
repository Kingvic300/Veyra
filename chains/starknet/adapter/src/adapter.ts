import { num, RpcProvider } from 'starknet';
import type { Asset, ExecutionMode, PaymentVerification } from '@veyra/core';
import {
  ChainAdapterError,
  compareTransfers,
  type BatchPlan,
  type ChainAdapter,
  type ChainCapabilities,
  type SignedTransaction,
  type TransactionRef,
  type TransactionState,
  type TransactionStatus,
  type UnsignedTransaction,
  type VerificationResult,
} from '@veyra/chain-adapter';
import {
  approveCall,
  cancelCall,
  computeItemsHash,
  decodeBatch,
  executeCall,
  joinU256,
  normaliseAddress,
  proposeCall,
  sameAddress,
  type OnchainBatch,
} from './encoding';
import { findApproved, findExecuted, findPayments, findProposed, findTokenTransfers, type RawEvent } from './events';
import { STRK20_POOL_ADDRESSES, STRK20_PRIVACY, VAULT_PRIVACY } from './privacy';

/** The subset of the Starknet JSON-RPC the adapter uses. `RpcProvider` satisfies it. */
export interface StarknetRpc {
  callContract(call: { contractAddress: string; entrypoint: string; calldata: string[] }): Promise<string[]>;
  getTransactionReceipt(txHash: string): Promise<unknown>;
  getTransactionByHash(txHash: string): Promise<unknown>;
  getTransactionStatus(txHash: string): Promise<unknown>;
}

export interface StarknetAdapterOptions {
  network: string;
  rpcUrl?: string;
  /** Inject an RPC client (tests, custom transports). */
  rpc?: StarknetRpc;
  /** Treat ACCEPTED_ON_L2 as final (default) or wait for ACCEPTED_ON_L1. */
  finality?: 'L2' | 'L1';
  maxBatchSize?: number;
}

interface Receipt {
  execution_status?: string;
  finality_status?: string;
  revert_reason?: string;
  block_number?: number;
  events?: RawEvent[];
}

/** Vault contract limit; keep in sync with `MAX_BATCH_ITEMS` in payroll_vault.cairo. */
export const VAULT_MAX_BATCH_ITEMS = 100;

abstract class StarknetAdapterBase implements ChainAdapter {
  protected readonly rpc: StarknetRpc;
  protected readonly network: string;
  protected readonly finality: 'L2' | 'L1';

  constructor(opts: StarknetAdapterOptions) {
    this.network = opts.network;
    this.finality = opts.finality ?? 'L2';
    if (opts.rpc) this.rpc = opts.rpc;
    else if (opts.rpcUrl) this.rpc = new RpcProvider({ nodeUrl: opts.rpcUrl }) as unknown as StarknetRpc;
    else throw new ChainAdapterError('MISCONFIGURED', `No Starknet RPC URL configured for ${opts.network}`);
  }

  abstract getCapabilities(): ChainCapabilities;
  abstract computeItemsHash(plan: BatchPlan): string | null;
  abstract buildProposal(plan: BatchPlan): UnsignedTransaction | null;
  abstract buildApproval(plan: BatchPlan): UnsignedTransaction | null;
  abstract createPayment(plan: BatchPlan): UnsignedTransaction;
  abstract buildCancellation(plan: BatchPlan): UnsignedTransaction | null;
  abstract verifyProposal(ref: TransactionRef, plan: BatchPlan): Promise<VerificationResult>;
  abstract verifyApproval(ref: TransactionRef, plan: BatchPlan, approver: string): Promise<VerificationResult>;
  abstract verifyPayment(ref: TransactionRef, plan: BatchPlan): Promise<PaymentVerification>;

  isValidAddress(address: string): boolean {
    try {
      return BigInt(normaliseAddress(address)) !== 0n;
    } catch {
      return false;
    }
  }

  normaliseAddress(address: string): string {
    if (!this.isValidAddress(address)) throw new ChainAdapterError('INVALID_ADDRESS', `Invalid Starknet address ${address}`);
    return normaliseAddress(address);
  }

  async getBalance(account: string, asset: Asset): Promise<bigint> {
    const owner = this.normaliseAddress(account);
    for (const entrypoint of ['balance_of', 'balanceOf']) {
      try {
        const result = await this.rpc.callContract({ contractAddress: asset.address, entrypoint, calldata: [owner] });
        if (result.length >= 2) return joinU256(result[0]!, result[1]!);
      } catch (err) {
        if (entrypoint === 'balanceOf') throw this.networkError(err);
      }
    }
    throw new ChainAdapterError('NETWORK', 'Token did not return a u256 balance');
  }

  async submitTransaction(_tx: SignedTransaction): Promise<TransactionRef> {
    throw new ChainAdapterError(
      'UNSUPPORTED',
      'Starknet transactions are signed and submitted by the user wallet; report the transaction hash instead',
    );
  }

  async getTransaction(ref: TransactionRef): Promise<TransactionStatus> {
    const receipt = await this.fetchReceipt(ref.txHash);
    if (receipt) return { ref, state: this.mapState(receipt), blockNumber: receipt.block_number ?? null, error: receipt.revert_reason ?? null };
    try {
      const status = (await this.rpc.getTransactionStatus(ref.txHash)) as { finality_status?: string; failure_reason?: string };
      if (status.finality_status === 'REJECTED') return { ref, state: 'REJECTED', blockNumber: null, error: status.failure_reason ?? 'Rejected' };
      if (status.finality_status) return { ref, state: 'PENDING', blockNumber: null, error: null };
    } catch (err) {
      if (!isNotFound(err)) throw this.networkError(err);
    }
    return { ref, state: 'NOT_FOUND', blockNumber: null, error: null };
  }

  /** Read a batch's on-chain state from a PayrollVault. */
  async getOnchainBatch(vault: string, chainBatchId: string): Promise<OnchainBatch> {
    try {
      const result = await this.rpc.callContract({ contractAddress: vault, entrypoint: 'get_batch', calldata: [num.toHex(chainBatchId)] });
      return decodeBatch(result);
    } catch (err) {
      throw this.networkError(err);
    }
  }

  protected mapState(receipt: Receipt): TransactionState {
    if (receipt.execution_status === 'REVERTED') return 'REVERTED';
    if (receipt.finality_status === 'ACCEPTED_ON_L1') return 'FINALISED';
    if (receipt.finality_status === 'ACCEPTED_ON_L2') return this.finality === 'L2' ? 'FINALISED' : 'ACCEPTED';
    return 'ACCEPTED';
  }

  protected async fetchReceipt(txHash: string): Promise<Receipt | null> {
    try {
      return (await this.rpc.getTransactionReceipt(txHash)) as Receipt;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw this.networkError(err);
    }
  }

  /** Load a receipt and require it to be final and successful. */
  protected async settledReceipt(ref: TransactionRef): Promise<{ receipt: Receipt | null; problems: string[] }> {
    const receipt = await this.fetchReceipt(ref.txHash);
    if (!receipt) return { receipt: null, problems: ['Transaction not found'] };
    const state = this.mapState(receipt);
    if (state === 'REVERTED') return { receipt, problems: [`Transaction reverted: ${receipt.revert_reason ?? 'unknown reason'}`] };
    if (state !== 'FINALISED') return { receipt, problems: ['Transaction is not final yet'] };
    return { receipt, problems: [] };
  }

  protected requireTreasury(plan: BatchPlan): string {
    if (!plan.treasuryAddress) throw new ChainAdapterError('MISCONFIGURED', 'Treasury address is not configured');
    return this.normaliseAddress(plan.treasuryAddress);
  }

  protected assertSize(plan: BatchPlan, max: number) {
    if (plan.items.length === 0) throw new ChainAdapterError('UNSUPPORTED', 'Batch has no payments');
    if (plan.items.length > max) throw new ChainAdapterError('BATCH_TOO_LARGE', `Batch exceeds ${max} payments`);
  }

  protected networkError(err: unknown): ChainAdapterError {
    if (err instanceof ChainAdapterError) return err;
    const message = err instanceof Error ? err.message : String(err);
    return new ChainAdapterError('NETWORK', `Starknet RPC error: ${message}`, true);
  }
}

function isNotFound(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /not found|TXN_HASH_NOT_FOUND|\b29\b/i.test(message);
}

/**
 * Transparent execution through the PayrollVault contract. Approvals and
 * execution are enforced on-chain; every payment is publicly verifiable.
 */
export class StarknetVaultAdapter extends StarknetAdapterBase {
  private readonly maxBatchSize: number;

  constructor(opts: StarknetAdapterOptions) {
    super(opts);
    this.maxBatchSize = Math.min(opts.maxBatchSize ?? VAULT_MAX_BATCH_ITEMS, VAULT_MAX_BATCH_ITEMS);
  }

  getCapabilities(): ChainCapabilities {
    return {
      chain: 'starknet',
      network: this.network,
      executionMode: 'vault',
      onChainApprovals: true,
      requiresProposal: true,
      signing: 'browser-wallet',
      maxBatchSize: this.maxBatchSize,
      finality: this.finality === 'L2' ? 'ACCEPTED_ON_L2' : 'ACCEPTED_ON_L1',
      verifiableAmounts: true,
      privacy: VAULT_PRIVACY,
    };
  }

  computeItemsHash(plan: BatchPlan): string {
    return computeItemsHash(plan.chainBatchId, plan.asset.address, plan.items);
  }

  buildProposal(plan: BatchPlan): UnsignedTransaction {
    this.assertSize(plan, this.maxBatchSize);
    const vault = this.requireTreasury(plan);
    return this.tx('propose', `Register batch ${plan.chainBatchId} with ${plan.items.length} payments for approval`, [
      proposeCall(vault, plan, this.computeItemsHash(plan)),
    ]);
  }

  buildApproval(plan: BatchPlan): UnsignedTransaction {
    return this.tx('approve', `Approve batch ${plan.chainBatchId}`, [approveCall(this.requireTreasury(plan), plan)]);
  }

  createPayment(plan: BatchPlan): UnsignedTransaction {
    this.assertSize(plan, this.maxBatchSize);
    return this.tx('execute', `Execute ${plan.items.length} payments from the payroll vault`, [executeCall(this.requireTreasury(plan), plan)]);
  }

  buildCancellation(plan: BatchPlan): UnsignedTransaction {
    return this.tx('cancel', `Cancel batch ${plan.chainBatchId} on-chain`, [cancelCall(this.requireTreasury(plan), plan)]);
  }

  async verifyProposal(ref: TransactionRef, plan: BatchPlan): Promise<VerificationResult> {
    const vault = this.requireTreasury(plan);
    const { receipt, problems } = await this.settledReceipt(ref);
    if (problems.length) return { verified: false, details: [], mismatches: problems };
    const event = findProposed(receipt!.events ?? [], vault).find((e) => e.batchId === BigInt(plan.chainBatchId));
    if (!event) return { verified: false, details: [], mismatches: ['No BatchProposed event for this batch'] };
    const mismatches: string[] = [];
    if (event.itemsHash !== BigInt(this.computeItemsHash(plan))) mismatches.push('On-chain items hash differs from the batch');
    if (event.total !== plan.total) mismatches.push(`On-chain total ${event.total} differs from ${plan.total}`);
    if (event.itemCount !== plan.items.length) mismatches.push('On-chain item count differs');
    if (!sameAddress(event.token, plan.asset.address)) mismatches.push('On-chain token differs');
    return { verified: mismatches.length === 0, details: [`Proposed by ${num.toHex(event.proposer)}`], mismatches };
  }

  async verifyApproval(ref: TransactionRef, plan: BatchPlan, approver: string): Promise<VerificationResult> {
    const vault = this.requireTreasury(plan);
    const { receipt, problems } = await this.settledReceipt(ref);
    if (problems.length) return { verified: false, details: [], mismatches: problems };
    const event = findApproved(receipt!.events ?? [], vault).find(
      (e) => e.batchId === BigInt(plan.chainBatchId) && sameAddress(e.approver, approver),
    );
    if (!event) return { verified: false, details: [], mismatches: ['No BatchApproved event from this approver for this batch'] };
    // The approval may have been revoked since; confirm current state.
    const still = await this.rpc
      .callContract({ contractAddress: vault, entrypoint: 'has_approved', calldata: [num.toHex(plan.chainBatchId), this.normaliseAddress(approver)] })
      .catch((err: unknown) => {
        throw this.networkError(err);
      });
    if (BigInt(still[0] ?? '0') !== 1n) return { verified: false, details: [], mismatches: ['Approval was revoked on-chain'] };
    return { verified: true, details: [`On-chain approvals: ${event.approvals}`], mismatches: [] };
  }

  async verifyPayment(ref: TransactionRef, plan: BatchPlan): Promise<PaymentVerification> {
    const checkedAt = new Date().toISOString();
    const vault = this.requireTreasury(plan);
    const { receipt, problems } = await this.settledReceipt(ref);
    if (problems.length) return { verified: false, method: 'onchain-events', checkedAt, details: [], mismatches: problems };
    const events = receipt!.events ?? [];
    const batchId = BigInt(plan.chainBatchId);
    const mismatches: string[] = [];
    const details: string[] = [];

    const executed = findExecuted(events, vault).find((e) => e.batchId === batchId);
    if (!executed) mismatches.push('No BatchExecuted event for this batch');
    else {
      details.push(`BatchExecuted by ${num.toHex(executed.executor)} in block ${receipt!.block_number ?? 'unknown'}`);
      if (executed.total !== plan.total) mismatches.push(`Executed total ${executed.total} differs from ${plan.total}`);
    }

    const payments = findPayments(events, vault).filter((p) => p.batchId === batchId);
    mismatches.push(...compareTransfers(plan, payments.map((p) => ({ to: num.toHex(p.to), amount: p.amount }))).map((m) => `Vault event: ${m}`));

    // Independent check against the token's own Transfer events.
    const transfers = findTokenTransfers(events, plan.asset.address).filter((t) => sameAddress(t.from, vault));
    mismatches.push(...compareTransfers(plan, transfers.map((t) => ({ to: num.toHex(t.to), amount: t.amount }))).map((m) => `Token event: ${m}`));
    details.push(`${payments.length} PaymentSent events, ${transfers.length} token transfers from the vault`);

    return { verified: mismatches.length === 0, method: 'onchain-events', checkedAt, details, mismatches };
  }

  private tx(kind: UnsignedTransaction['kind'], description: string, calls: UnsignedTransaction['calls']): UnsignedTransaction {
    return { chain: 'starknet', network: this.network, kind, description, calls };
  }
}

/**
 * EXPERIMENTAL. Private payouts through the STRK20 privacy pool. The payer
 * account (treasuryAddress) must be a privacy-enabled wallet holding a
 * shielded balance; recipients must be registered with the pool. The dashboard
 * passes `extra.strk20Actions` to `WalletAccountV6.strk20InvokeTransaction`.
 */
export class StarknetStrk20Adapter extends StarknetAdapterBase {
  private readonly maxBatchSize: number;

  constructor(opts: StarknetAdapterOptions) {
    super(opts);
    // No documented per-transaction limit for transfer actions; stay conservative.
    this.maxBatchSize = opts.maxBatchSize ?? 20;
  }

  getCapabilities(): ChainCapabilities {
    return {
      chain: 'starknet',
      network: this.network,
      executionMode: 'strk20-private',
      onChainApprovals: false,
      requiresProposal: false,
      signing: 'browser-wallet',
      maxBatchSize: this.maxBatchSize,
      finality: this.finality === 'L2' ? 'ACCEPTED_ON_L2' : 'ACCEPTED_ON_L1',
      verifiableAmounts: false,
      privacy: STRK20_PRIVACY,
    };
  }

  computeItemsHash(): null {
    return null;
  }

  buildProposal(): null {
    return null;
  }

  buildApproval(): null {
    return null;
  }

  buildCancellation(): null {
    return null;
  }

  override async getBalance(): Promise<bigint> {
    throw new ChainAdapterError('UNSUPPORTED', 'Shielded balances are only visible to the payer wallet (strk20Balances)');
  }

  createPayment(plan: BatchPlan): UnsignedTransaction {
    this.assertSize(plan, this.maxBatchSize);
    this.requireTreasury(plan);
    const pool = STRK20_POOL_ADDRESSES[this.network];
    if (!pool) throw new ChainAdapterError('UNSUPPORTED', `STRK20 is not available on ${this.network}`);
    const token = this.normaliseAddress(plan.asset.address);
    return {
      chain: 'starknet',
      network: this.network,
      kind: 'execute',
      description: `Private payout of ${plan.items.length} payments through STRK20 (experimental)`,
      calls: [],
      extra: {
        strk20PoolAddress: pool,
        strk20Actions: plan.items.map((i) => ({
          type: 'transfer',
          token,
          amount: num.toHex(i.amount),
          recipient: this.normaliseAddress(i.recipient),
        })),
      },
    };
  }

  async verifyProposal(): Promise<VerificationResult> {
    return { verified: true, details: ['No on-chain proposal in STRK20 mode'], mismatches: [] };
  }

  async verifyApproval(): Promise<VerificationResult> {
    return { verified: true, details: ['Approvals are enforced by the Veyra API in STRK20 mode'], mismatches: [] };
  }

  async verifyPayment(ref: TransactionRef, plan: BatchPlan): Promise<PaymentVerification> {
    const checkedAt = new Date().toISOString();
    const payer = this.requireTreasury(plan);
    const { problems } = await this.settledReceipt(ref);
    if (problems.length) return { verified: false, method: 'transaction-status', checkedAt, details: [], mismatches: problems };
    const tx = (await this.rpc.getTransactionByHash(ref.txHash).catch((err: unknown) => {
      throw this.networkError(err);
    })) as { sender_address?: string };
    const mismatches: string[] = [];
    if (!tx.sender_address || !sameAddress(tx.sender_address, payer)) mismatches.push('Transaction was not sent by the configured payer account');
    return {
      verified: mismatches.length === 0,
      method: 'transaction-status',
      checkedAt,
      details: [
        'Transaction succeeded and was sent by the payer account.',
        'Shielded recipients and amounts cannot be verified without the payer viewing key.',
      ],
      mismatches,
    };
  }
}

export function createStarknetAdapter(mode: ExecutionMode, opts: StarknetAdapterOptions): ChainAdapter {
  if (mode === 'vault') return new StarknetVaultAdapter(opts);
  if (mode === 'strk20-private') return new StarknetStrk20Adapter(opts);
  throw new ChainAdapterError('UNSUPPORTED', `Starknet does not support execution mode ${mode}`);
}
