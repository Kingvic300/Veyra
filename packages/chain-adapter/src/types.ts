import type { Asset, ChainId, ExecutionMode, PaymentVerification, PrivacyCapabilities } from '@veyra/core';

/**
 * Chain adapters isolate everything network-specific: address formats, call
 * construction, signing model, finality and verification. The shared payroll
 * core never imports a chain SDK directly.
 */

export interface ChainCapabilities {
  chain: ChainId;
  network: string;
  executionMode: ExecutionMode;
  /** Approvals are enforced by a contract (true) or by the Veyra API (false). */
  onChainApprovals: boolean;
  /** Batch must be registered on-chain before approvals are possible. */
  requiresProposal: boolean;
  /** Who signs transactions. Veyra never holds production signing keys. */
  signing: 'browser-wallet' | 'server-simulated';
  maxBatchSize: number;
  /** Human description of when a transaction is considered final. */
  finality: string;
  /** Whether payment amounts can be verified independently from chain data. */
  verifiableAmounts: boolean;
  privacy: PrivacyCapabilities;
}

export interface PlannedPayment {
  recipient: string;
  amount: bigint;
}

/** Everything an adapter needs to build or verify batch transactions. */
export interface BatchPlan {
  /** Chain-specific batch identifier (128-bit hex). */
  chainBatchId: string;
  asset: Asset;
  /** Vault contract (vault mode) or paying account (strk20-private). */
  treasuryAddress: string | null;
  items: readonly PlannedPayment[];
  total: bigint;
}

export type TransactionKind = 'propose' | 'approve' | 'execute' | 'cancel';

/** A generic contract call. Chains with a different model put data in `extra`. */
export interface ChainCall {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

/** Unsigned transaction handed to a wallet for review and signature. */
export interface UnsignedTransaction {
  chain: ChainId;
  network: string;
  kind: TransactionKind;
  description: string;
  calls: ChainCall[];
  /** Extra wallet instructions, for example STRK20 privacy actions. */
  extra?: Record<string, unknown>;
}

/** A transaction signed by a server-side signer (simulated chain only). */
export interface SignedTransaction {
  kind: TransactionKind;
  plan: BatchPlan;
}

export interface TransactionRef {
  chain: ChainId;
  network: string;
  txHash: string;
}

export type TransactionState =
  | 'NOT_FOUND'
  | 'PENDING'
  /** Included in a block; not yet final under the chain's finality rule. */
  | 'ACCEPTED'
  | 'FINALISED'
  | 'REVERTED'
  | 'REJECTED';

export interface TransactionStatus {
  ref: TransactionRef;
  state: TransactionState;
  blockNumber: number | null;
  error: string | null;
}

export interface VerificationResult {
  verified: boolean;
  details: string[];
  mismatches: string[];
}

export interface ChainAdapter {
  getCapabilities(): ChainCapabilities;
  isValidAddress(address: string): boolean;
  /** Canonical, comparable address form. */
  normaliseAddress(address: string): string;
  getBalance(account: string, asset: Asset): Promise<bigint>;
  /** Chain-specific hash that on-chain approvals bind to, if any. */
  computeItemsHash(plan: BatchPlan): string | null;
  buildProposal(plan: BatchPlan): UnsignedTransaction | null;
  buildApproval(plan: BatchPlan): UnsignedTransaction | null;
  /** Build the payment execution transaction (spec: `createPayment`). */
  createPayment(plan: BatchPlan): UnsignedTransaction;
  buildCancellation(plan: BatchPlan): UnsignedTransaction | null;
  /** Broadcast a server-signed transaction. Only supported by simulated adapters. */
  submitTransaction(tx: SignedTransaction): Promise<TransactionRef>;
  getTransaction(ref: TransactionRef): Promise<TransactionStatus>;
  verifyProposal(ref: TransactionRef, plan: BatchPlan): Promise<VerificationResult>;
  verifyApproval(ref: TransactionRef, plan: BatchPlan, approver: string): Promise<VerificationResult>;
  verifyPayment(ref: TransactionRef, plan: BatchPlan): Promise<PaymentVerification>;
}

export type ChainErrorCode =
  | 'UNSUPPORTED'
  | 'INVALID_ADDRESS'
  | 'INSUFFICIENT_FUNDS'
  | 'NETWORK'
  | 'NOT_FOUND'
  | 'BATCH_TOO_LARGE'
  | 'MISCONFIGURED';

export class ChainAdapterError extends Error {
  constructor(
    readonly code: ChainErrorCode,
    message: string,
    /** Safe to retry the same operation later. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ChainAdapterError';
  }
}

export function isFinalState(state: TransactionState): boolean {
  return state === 'FINALISED' || state === 'REVERTED' || state === 'REJECTED';
}
