import { isApprovingRole, type Role } from './roles';
import type { ApprovalPolicy, ApprovalStatus } from './types';

export interface ApprovalRecord {
  memberId: string;
  status: ApprovalStatus;
}

export interface ApproverInfo {
  memberId: string;
  role: Role;
}

export interface ApprovalEvaluation {
  confirmed: number;
  pending: number;
  required: number;
  satisfied: boolean;
  /** Members who may still approve. */
  eligibleRemaining: string[];
  /** True when not enough eligible approvers exist to ever reach the threshold. */
  unreachable: boolean;
}

export type ApprovalRejection =
  | 'NOT_APPROVER'
  | 'CREATOR_CANNOT_APPROVE'
  | 'ALREADY_APPROVED'
  | 'BATCH_NOT_PENDING';

/** Check if a member may approve. Returns null when allowed. */
export function checkCanApprove(params: {
  member: ApproverInfo;
  batchCreatedBy: string;
  batchPending: boolean;
  policy: ApprovalPolicy;
  existing: readonly ApprovalRecord[];
}): ApprovalRejection | null {
  const { member, batchCreatedBy, batchPending, policy, existing } = params;
  if (!batchPending) return 'BATCH_NOT_PENDING';
  if (!isApprovingRole(member.role)) return 'NOT_APPROVER';
  if (!policy.allowCreatorApproval && member.memberId === batchCreatedBy) return 'CREATOR_CANNOT_APPROVE';
  if (existing.some((a) => a.memberId === member.memberId && a.status !== 'FAILED')) return 'ALREADY_APPROVED';
  return null;
}

export function evaluateApprovals(params: {
  policy: ApprovalPolicy;
  approvals: readonly ApprovalRecord[];
  approvers: readonly ApproverInfo[];
  batchCreatedBy: string;
}): ApprovalEvaluation {
  const { policy, approvals, approvers, batchCreatedBy } = params;
  const eligible = approvers.filter(
    (a) => isApprovingRole(a.role) && (policy.allowCreatorApproval || a.memberId !== batchCreatedBy),
  );
  const eligibleIds = new Set(eligible.map((a) => a.memberId));
  // Count only approvals from members who are still eligible.
  const confirmedIds = new Set(
    approvals.filter((a) => a.status === 'CONFIRMED' && eligibleIds.has(a.memberId)).map((a) => a.memberId),
  );
  const pendingIds = new Set(
    approvals.filter((a) => a.status === 'PENDING_CHAIN' && eligibleIds.has(a.memberId)).map((a) => a.memberId),
  );
  const acted = new Set([...confirmedIds, ...pendingIds]);
  const eligibleRemaining = eligible.map((a) => a.memberId).filter((id) => !acted.has(id));
  return {
    confirmed: confirmedIds.size,
    pending: pendingIds.size,
    required: policy.threshold,
    satisfied: confirmedIds.size >= policy.threshold,
    eligibleRemaining,
    unreachable: eligible.length < policy.threshold,
  };
}
