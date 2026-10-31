import type { BatchStatus, ExecutionMode, PaymentStatus } from './batch';
import type { Role } from './roles';
import type { PrivacyCapabilities } from './privacy';

/**
 * Shared domain model. These are the wire shapes returned by the Veyra API and
 * consumed by the SDK and dashboard. Amounts are base-unit integer strings.
 */

export type ChainId = 'starknet' | 'simulated';

export interface Asset {
  /** Token contract address (or a symbolic id for the simulated chain). */
  address: string;
  symbol: string;
  decimals: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Organisation {
  id: string;
  name: string;
  chain: ChainId;
  /** Network identifier, for example `sepolia` or `mainnet`. */
  network: string;
  executionMode: ExecutionMode;
  /** PayrollVault contract address (vault mode) or payer account (strk20-private). */
  treasuryAddress: string | null;
  asset: Asset;
  approvalPolicy: ApprovalPolicy;
  createdAt: string;
}

export interface ApprovalPolicy {
  /** Distinct approvals required before execution. */
  threshold: number;
  /** Whether the member who created a batch may also approve it. */
  allowCreatorApproval: boolean;
  /** Maximum total per batch in base units, or null for no limit. */
  maxBatchTotal: string | null;
}

export interface Member {
  id: string;
  organisationId: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** Wallet used to sign approvals / executions on-chain. */
  walletAddress: string | null;
  createdAt: string;
}

export interface Contractor {
  id: string;
  organisationId: string;
  name: string;
  email: string | null;
  country: string | null;
  payoutAddress: string;
  active: boolean;
  createdAt: string;
}

export interface Treasury {
  organisationId: string;
  chain: ChainId;
  network: string;
  address: string | null;
  asset: Asset;
  /** On-chain balance, or null if the treasury is not configured / unreachable. */
  balance: string | null;
  /** Sum of APPROVED and EXECUTING batches not yet paid. */
  committed: string;
  /** balance - committed, or null if balance unknown. */
  available: string | null;
  privacy: PrivacyCapabilities;
  error?: string;
}

export interface PayrollItem {
  id: string;
  batchId: string;
  contractorId: string;
  contractorName: string;
  recipient: string;
  amount: string;
  position: number;
}

export type ChainActionStatus = 'NONE' | 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface PayrollBatch {
  id: string;
  organisationId: string;
  title: string;
  status: BatchStatus;
  executionMode: ExecutionMode;
  asset: Asset;
  total: string;
  itemCount: number;
  /** Chain-agnostic SHA-256 commitment over the batch contents. */
  commitment: string | null;
  /** Chain-specific identifier of the batch (for example a felt252 on Starknet). */
  chainBatchId: string;
  /** Chain-specific items hash that on-chain approvals bind to. */
  chainItemsHash: string | null;
  proposal: { status: ChainActionStatus; txHash: string | null };
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  items?: PayrollItem[];
  approvals?: Approval[];
  executions?: Execution[];
  payments?: Payment[];
}

export type ApprovalStatus = 'PENDING_CHAIN' | 'CONFIRMED' | 'FAILED';

export interface Approval {
  id: string;
  batchId: string;
  memberId: string;
  memberName: string;
  status: ApprovalStatus;
  txHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export type ExecutionStatus = 'SUBMITTED' | 'CONFIRMED' | 'FAILED';

/** One execution attempt of a batch. Retries create a new attempt. */
export interface Execution {
  id: string;
  batchId: string;
  attempt: number;
  status: ExecutionStatus;
  txHash: string | null;
  submittedBy: string;
  error: string | null;
  verification: PaymentVerification | null;
  createdAt: string;
  finalisedAt: string | null;
}

export interface Payment {
  id: string;
  batchId: string;
  itemId: string;
  recipient: string;
  amount: string;
  status: PaymentStatus;
  txHash: string | null;
  verified: boolean;
  updatedAt: string;
}

export interface PaymentVerification {
  verified: boolean;
  /** What level of evidence the chain and mode allow. */
  method: 'onchain-events' | 'transaction-status' | 'simulated';
  checkedAt: string;
  details: string[];
  mismatches: string[];
}

export interface AuditEvent {
  id: string;
  organisationId: string;
  seq: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export interface Receipt {
  receiptVersion: 1;
  generatedAt: string;
  organisation: { id: string; name: string };
  batch: {
    id: string;
    title: string;
    status: BatchStatus;
    executionMode: ExecutionMode;
    chain: ChainId;
    network: string;
    asset: Asset;
    total: string;
    commitment: string | null;
    chainBatchId: string;
    chainItemsHash: string | null;
    treasuryAddress: string | null;
  };
  items: { recipient: string; contractorName: string; amount: string; status: PaymentStatus; txHash: string | null }[];
  approvals: { memberName: string; status: ApprovalStatus; txHash: string | null; confirmedAt: string | null }[];
  execution: Execution | null;
  privacy: PrivacyCapabilities;
  auditTrail: { seq: number; action: string; createdAt: string; hash: string }[];
}

export interface MonthlySpend {
  /** YYYY-MM */
  month: string;
  total: string;
  batches: number;
  payments: number;
}

export interface ContractorEarnings {
  contractorId: string;
  name: string;
  country: string | null;
  total: string;
  payments: number;
  lastPaidAt: string | null;
}

export interface OrganisationStats {
  asset: Asset;
  paidAllTime: string;
  paidThisMonth: string;
  paidLastMonth: string;
  completedBatches: number;
  completedPayments: number;
  activeContractors: number;
  awaitingApproval: { count: number; total: string };
  readyToPay: { count: number; total: string };
  failed: number;
  drafts: number;
  /** Last 6 calendar months, oldest first, zero-filled. */
  monthly: MonthlySpend[];
  /** Median hours from submission to full approval; null with no data. */
  medianApprovalHours: number | null;
  /** Median seconds from payment submission to final settlement. */
  medianSettlementSeconds: number | null;
  /** Only for roles that can read contractor records. */
  byCountry: { country: string; total: string; contractors: number }[] | null;
  contractors: ContractorEarnings[] | null;
}
