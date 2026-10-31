import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, inArray, max } from 'drizzle-orm';
import {
  AuditActions,
  assertBatchTransition,
  canTransition,
  checkCanApprove,
  computeBatchCommitment,
  evaluateApprovals,
  isEditable,
  parseUnits,
  uuidToHex,
  validateBatch,
  type ApprovalEvaluation,
  type BatchStatus,
  type CreateBatchInput,
  type PaymentVerification,
  type PayrollBatch,
  type PayrollItem,
  type Receipt,
  type Role,
  type UpdateBatchInput,
} from '@veyra/core';
import type { BatchPlan, TransactionKind, UnsignedTransaction, VerificationResult } from '@veyra/chain-adapter';
import { DB, schema, type Db, type Executor, type Tx } from '../db/database.js';
import { AccessService, isUuid, type AccessContext, type OrgRow } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ChainService } from '../chain/chain.service.js';
import { EncryptionService } from '../common/encryption.service.js';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { Purpose } from '../contractors/contractors.service.js';
import { OrganisationsService } from '../organisations/organisations.service.js';
import { TxMonitor } from '../jobs/tx-monitor.js';
import { toApproval, toBatch, toExecution, toPayment, type BatchRow } from './batch-mappers.js';

export interface DecodedItem {
  id: string;
  contractorId: string;
  contractorName: string;
  position: number;
  recipient: string | null;
  amount: bigint;
}

export interface BatchDetail extends PayrollBatch {
  approvalSummary: ApprovalEvaluation;
  privacyLabel: string;
  shielded: boolean;
}

@Injectable()
export class BatchesService {
  private readonly logger = new Logger('BatchesService');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly chain: ChainService,
    private readonly crypto: EncryptionService,
    private readonly orgs: OrganisationsService,
    private readonly monitor: TxMonitor,
  ) {}

  // ---- Queries -----------------------------------------------------------

  async list(userId: string, orgId: string, status?: string): Promise<PayrollBatch[]> {
    await this.access.require(userId, orgId, 'batches:read');
    const conditions = [eq(schema.payrollBatches.organisationId, orgId)];
    if (status) conditions.push(eq(schema.payrollBatches.status, status));
    const rows = await this.db
      .select()
      .from(schema.payrollBatches)
      .where(and(...conditions))
      .orderBy(desc(schema.payrollBatches.createdAt))
      .limit(500);
    return rows.map(toBatch);
  }

  async get(userId: string, orgId: string, batchId: string): Promise<BatchDetail> {
    const ctx = await this.access.require(userId, orgId, 'batches:read');
    return this.detail(ctx, await this.findBatch(this.db, orgId, batchId));
  }

  private async detail(ctx: AccessContext, row: BatchRow): Promise<BatchDetail> {
    const { org, member } = ctx;
    const canSeeItems = member.role !== 'VIEWER';
    const items = await this.decodeItems(this.db, org, row.id);
    const approvalRows = await this.db
      .select({ approval: schema.approvals, name: schema.users.name })
      .from(schema.approvals)
      .innerJoin(schema.members, eq(schema.members.id, schema.approvals.memberId))
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(eq(schema.approvals.batchId, row.id))
      .orderBy(asc(schema.approvals.createdAt));
    const executionRows = await this.db
      .select()
      .from(schema.executions)
      .where(eq(schema.executions.batchId, row.id))
      .orderBy(asc(schema.executions.attempt));
    const paymentRows = await this.db.select().from(schema.payments).where(eq(schema.payments.batchId, row.id));
    const caps = this.chain.capabilities(org);
    const byItem = new Map(items.map((i) => [i.id, i]));

    return {
      ...toBatch(row),
      items: canSeeItems ? items.map((i) => this.toItem(row.id, i)) : undefined,
      approvals: approvalRows.map((r) => toApproval(r.approval, r.name)),
      executions: executionRows.map(toExecution),
      payments: canSeeItems
        ? paymentRows.map((p) => {
            const item = byItem.get(p.itemId);
            return toPayment(p, item?.recipient ?? '', item?.amount.toString() ?? '0');
          })
        : undefined,
      approvalSummary: await this.evaluate(this.db, org, row),
      privacyLabel: caps.privacy.label,
      shielded: caps.privacy.shieldedTransfers,
    };
  }

  private toItem(batchId: string, i: DecodedItem): PayrollItem {
    return {
      id: i.id,
      batchId,
      contractorId: i.contractorId,
      contractorName: i.contractorName,
      recipient: i.recipient ?? '',
      amount: i.amount.toString(),
      position: i.position,
    };
  }

  // ---- Draft lifecycle -----------------------------------------------------

  async create(userId: string, orgId: string, input: CreateBatchInput): Promise<PayrollBatch> {
    const { org, member } = await this.access.require(userId, orgId, 'batches:write');
    const id = randomUUID();
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.payrollBatches)
        .values({
          id,
          organisationId: orgId,
          title: input.title,
          status: 'DRAFT',
          executionMode: org.executionMode,
          assetAddress: org.assetAddress,
          assetSymbol: org.assetSymbol,
          assetDecimals: org.assetDecimals,
          chainBatchId: uuidToHex(id),
          createdBy: member.id,
        })
        .returning();
      const updated = await this.replaceItems(tx, org, row!, input.items);
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.BatchCreated,
        entityType: 'batch',
        entityId: id,
        data: { itemCount: updated.itemCount, total: updated.total },
      });
      return toBatch(updated);
    });
  }

  async update(userId: string, orgId: string, batchId: string, input: UpdateBatchInput): Promise<PayrollBatch> {
    const { org } = await this.access.require(userId, orgId, 'batches:write');
    return this.db.transaction(async (tx) => {
      let row = await this.findBatch(tx, orgId, batchId, true);
      if (!isEditable(row.status as BatchStatus)) throw conflict('NOT_EDITABLE', 'Only draft batches can be edited');
      if (input.title !== undefined) {
        [row] = (await tx
          .update(schema.payrollBatches)
          .set({ title: input.title, updatedAt: new Date() })
          .where(eq(schema.payrollBatches.id, batchId))
          .returning()) as [BatchRow];
      }
      if (input.items !== undefined) row = await this.replaceItems(tx, org, row, input.items);
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.BatchUpdated,
        entityType: 'batch',
        entityId: batchId,
        data: { itemCount: row.itemCount, total: row.total },
      });
      return toBatch(row);
    });
  }

  private async replaceItems(tx: Tx, org: OrgRow, batch: BatchRow, items: CreateBatchInput['items']): Promise<BatchRow> {
    const ids = items.map((i) => i.contractorId);
    if (new Set(ids).size !== ids.length) {
      throw badRequest('DUPLICATE_CONTRACTOR', 'Each contractor can appear only once per batch; combine the amounts');
    }
    const contractors = ids.length
      ? await tx
          .select()
          .from(schema.contractors)
          .where(and(eq(schema.contractors.organisationId, org.id), inArray(schema.contractors.id, ids)))
      : [];
    const byId = new Map(contractors.map((c) => [c.id, c]));
    const enc = (purpose: string, v: string) => this.crypto.encrypt(org.id, org.dataKeyEnc, purpose, v);

    let total = 0n;
    const values = items.map((item, position) => {
      const contractor = byId.get(item.contractorId);
      if (!contractor) throw badRequest('UNKNOWN_CONTRACTOR', `Contractor ${item.contractorId} not found`, { position });
      const amount = parseUnits(item.amount, org.assetDecimals);
      if (amount <= 0n) throw badRequest('NON_POSITIVE_AMOUNT', 'Amounts must be greater than zero', { position });
      total += amount;
      const payout = this.crypto.decrypt(org.id, org.dataKeyEnc, Purpose.ContractorPayout, contractor.payoutAddressEnc);
      return {
        batchId: batch.id,
        contractorId: contractor.id,
        position,
        recipientEnc: enc(Purpose.ItemRecipient, payout),
        amountEnc: enc(Purpose.ItemAmount, amount.toString()),
      };
    });

    await tx.delete(schema.payrollItems).where(eq(schema.payrollItems.batchId, batch.id));
    if (values.length) await tx.insert(schema.payrollItems).values(values);
    const [row] = await tx
      .update(schema.payrollBatches)
      .set({ total: total.toString(), itemCount: values.length, updatedAt: new Date() })
      .where(eq(schema.payrollBatches.id, batch.id))
      .returning();
    return row!;
  }

  /** Dry-run validation used by the review screen. */
  async validate(userId: string, orgId: string, batchId: string) {
    const { org } = await this.access.require(userId, orgId, 'batches:read');
    const row = await this.findBatch(this.db, orgId, batchId);
    return this.runValidation(this.db, org, row);
  }

  private async runValidation(db: Executor, org: OrgRow, row: BatchRow) {
    const adapter = this.chain.adapter(org);
    const caps = adapter.getCapabilities();
    const items = await this.decodeItems(db, org, row.id);
    const contractorIds = items.map((i) => i.contractorId);
    const contractors = contractorIds.length
      ? await db.select().from(schema.contractors).where(inArray(schema.contractors.id, contractorIds))
      : [];
    const active = new Map(contractors.map((c) => [c.id, c.active]));
    const treasury = await this.orgs.treasuryFor(org, adapter);
    // Funds already committed to this same batch must not count against it.
    const ownCommitment = ['APPROVED', 'EXECUTING'].includes(row.status) ? BigInt(row.total) : 0n;
    const available = treasury.available === null ? null : BigInt(treasury.available) + ownCommitment;
    const result = validateBatch(
      items.map((i) => ({
        contractorId: i.contractorId,
        recipient: i.recipient,
        amount: i.amount,
        contractorActive: active.get(i.contractorId) ?? false,
      })),
      {
        maxItems: caps.maxBatchSize,
        policy: {
          threshold: org.approvalThreshold,
          allowCreatorApproval: org.allowCreatorApproval,
          maxBatchTotal: org.maxBatchTotal,
        },
        availableBalance: available,
        isValidRecipient: (a) => adapter.isValidAddress(a),
      },
    );
    const issues = [...result.issues];
    if (!org.treasuryAddress) {
      issues.push({ code: 'INSUFFICIENT_TREASURY', message: 'Configure a treasury address before submitting', severity: 'error' });
    }
    if (treasury.error && org.treasuryAddress) {
      issues.push({ code: 'INSUFFICIENT_TREASURY', message: `Treasury balance unavailable: ${treasury.error}`, severity: 'warning' });
    }
    return {
      ok: !issues.some((i) => i.severity === 'error'),
      total: result.total.toString(),
      issues,
      treasury,
      capabilities: caps,
      items,
    };
  }

  // ---- Submission and approvals -----------------------------------------------

  async submit(userId: string, orgId: string, batchId: string): Promise<BatchDetail> {
    const ctx = await this.access.require(userId, orgId, 'batches:write');
    const { org } = ctx;
    const adapter = this.chain.adapter(org);
    const caps = adapter.getCapabilities();

    await this.db.transaction(async (tx) => {
      const row = await this.findBatch(tx, orgId, batchId, true);
      assertBatchTransition(row.status as BatchStatus, 'PENDING_APPROVAL');

      // Refresh recipient snapshots from current contractor payout addresses.
      await this.refreshRecipients(tx, org, row.id);
      const validation = await this.runValidation(tx, org, row);
      if (!validation.ok) {
        throw badRequest('BATCH_INVALID', 'Fix the batch issues before submitting', validation.issues);
      }
      const items = validation.items.map((i) => ({ recipient: adapter.normaliseAddress(i.recipient!), amount: i.amount }));
      const plan = this.buildPlan(row, org.treasuryAddress, items);
      const commitment = await computeBatchCommitment({
        batchId: row.id,
        organisationId: orgId,
        chain: org.chain,
        network: org.network,
        asset: row.assetAddress,
        items,
      });
      await tx
        .update(schema.payrollBatches)
        .set({
          status: 'PENDING_APPROVAL',
          treasuryAddress: org.treasuryAddress,
          commitment,
          chainItemsHash: adapter.computeItemsHash(plan),
          proposalStatus: caps.requiresProposal ? 'NONE' : 'CONFIRMED',
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.payrollBatches.id, row.id));
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.BatchSubmitted,
        entityType: 'batch',
        entityId: row.id,
        data: { commitment, total: row.total, itemCount: row.itemCount, treasuryAddress: org.treasuryAddress },
      });
    });
    return this.detail(ctx, await this.findBatch(this.db, orgId, batchId));
  }

  private async refreshRecipients(tx: Tx, org: OrgRow, batchId: string) {
    const rows = await tx
      .select({ itemId: schema.payrollItems.id, payout: schema.contractors.payoutAddressEnc })
      .from(schema.payrollItems)
      .innerJoin(schema.contractors, eq(schema.contractors.id, schema.payrollItems.contractorId))
      .where(eq(schema.payrollItems.batchId, batchId));
    for (const r of rows) {
      const payout = this.crypto.decrypt(org.id, org.dataKeyEnc, Purpose.ContractorPayout, r.payout);
      await tx
        .update(schema.payrollItems)
        .set({ recipientEnc: this.crypto.encrypt(org.id, org.dataKeyEnc, Purpose.ItemRecipient, payout) })
        .where(eq(schema.payrollItems.id, r.itemId));
    }
  }

  /** Report the wallet transaction that registered the batch on-chain. */
  async recordProposal(userId: string, orgId: string, batchId: string, txHash: string): Promise<BatchDetail> {
    const ctx = await this.access.require(userId, orgId, 'batches:write');
    const caps = this.chain.capabilities(ctx.org);
    if (!caps.requiresProposal) throw badRequest('NOT_REQUIRED', 'This execution mode does not use on-chain proposals');
    await this.db.transaction(async (tx) => {
      const row = await this.findBatch(tx, orgId, batchId, true);
      if (row.status !== 'PENDING_APPROVAL') throw conflict('INVALID_STATE', 'Batch is not awaiting approval');
      if (row.proposalStatus === 'PENDING' || row.proposalStatus === 'CONFIRMED') {
        throw conflict('PROPOSAL_EXISTS', 'A proposal transaction is already recorded');
      }
      await tx
        .update(schema.payrollBatches)
        .set({ proposalStatus: 'PENDING', proposalTxHash: txHash, proposalError: null, updatedAt: new Date() })
        .where(eq(schema.payrollBatches.id, batchId));
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.BatchProposalRecorded,
        entityType: 'batch',
        entityId: batchId,
        data: { txHash },
      });
    });
    await this.monitor.enqueue({ kind: 'proposal', id: batchId });
    return this.detail(ctx, await this.findBatch(this.db, orgId, batchId));
  }

  async approve(userId: string, orgId: string, batchId: string, txHash: string | undefined): Promise<BatchDetail> {
    const ctx = await this.access.require(userId, orgId, 'batches:approve');
    const { org, member } = ctx;
    const caps = this.chain.capabilities(org);
    if (caps.onChainApprovals) {
      if (!txHash) throw badRequest('TX_REQUIRED', 'Sign the approval in your wallet and send the transaction hash');
      if (!member.walletAddress) throw badRequest('NO_WALLET', 'Link your approver wallet to your membership first');
    } else if (txHash) {
      throw badRequest('TX_NOT_EXPECTED', 'Approvals in this mode are recorded by Veyra, not on-chain');
    }

    let approvalId = '';
    await this.db.transaction(async (tx) => {
      const row = await this.findBatch(tx, orgId, batchId, true);
      if (caps.requiresProposal && row.proposalStatus !== 'CONFIRMED') {
        throw conflict('PROPOSAL_PENDING', 'The batch must be registered on-chain before it can be approved');
      }
      const existing = await tx.select().from(schema.approvals).where(eq(schema.approvals.batchId, batchId));
      const rejection = checkCanApprove({
        member: { memberId: member.id, role: member.role },
        batchCreatedBy: row.createdBy,
        batchPending: row.status === 'PENDING_APPROVAL',
        policy: this.policy(org),
        existing: existing.map((a) => ({ memberId: a.memberId, status: a.status as 'CONFIRMED' })),
      });
      if (rejection) throw conflict(rejection, approvalMessage(rejection));
      const [approval] = await tx
        .insert(schema.approvals)
        .values({
          batchId,
          memberId: member.id,
          status: caps.onChainApprovals ? 'PENDING_CHAIN' : 'CONFIRMED',
          walletAddress: member.walletAddress,
          txHash: txHash ?? null,
          confirmedAt: caps.onChainApprovals ? null : new Date(),
        })
        .returning();
      approvalId = approval!.id;
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.ApprovalRecorded,
        entityType: 'batch',
        entityId: batchId,
        data: { approvalId, memberId: member.id, txHash: txHash ?? null, onChain: caps.onChainApprovals },
      });
      if (!caps.onChainApprovals) await this.promoteIfApproved(tx, org, row, userId);
    });
    if (caps.onChainApprovals) await this.monitor.enqueue({ kind: 'approval', id: approvalId });
    return this.detail(ctx, await this.findBatch(this.db, orgId, batchId));
  }

  private policy(org: OrgRow) {
    return { threshold: org.approvalThreshold, allowCreatorApproval: org.allowCreatorApproval, maxBatchTotal: org.maxBatchTotal };
  }

  private async evaluate(db: Executor, org: OrgRow, row: BatchRow): Promise<ApprovalEvaluation> {
    const approvalRows = await db.select().from(schema.approvals).where(eq(schema.approvals.batchId, row.id));
    const memberRows = await db
      .select({ id: schema.members.id, role: schema.members.role })
      .from(schema.members)
      .where(eq(schema.members.organisationId, org.id));
    return evaluateApprovals({
      policy: this.policy(org),
      approvals: approvalRows.map((a) => ({ memberId: a.memberId, status: a.status as 'CONFIRMED' })),
      approvers: memberRows.map((m) => ({ memberId: m.id, role: m.role as Role })),
      batchCreatedBy: row.createdBy,
    });
  }

  private async promoteIfApproved(tx: Tx, org: OrgRow, row: BatchRow, actorId: string | null) {
    if (row.status !== 'PENDING_APPROVAL') return;
    const evaluation = await this.evaluate(tx, org, row);
    if (!evaluation.satisfied) return;
    assertBatchTransition('PENDING_APPROVAL', 'APPROVED');
    await tx
      .update(schema.payrollBatches)
      .set({ status: 'APPROVED', updatedAt: new Date() })
      .where(eq(schema.payrollBatches.id, row.id));
    await this.audit.append(tx, {
      organisationId: org.id,
      actorId,
      action: AuditActions.BatchApproved,
      entityType: 'batch',
      entityId: row.id,
      data: { approvals: evaluation.confirmed, threshold: evaluation.required },
    });
  }

  // ---- Execution -------------------------------------------------------------

  async execute(userId: string, orgId: string, batchId: string, txHash: string | undefined): Promise<BatchDetail> {
    const ctx = await this.access.require(userId, orgId, 'batches:execute');
    const { org, member } = ctx;
    const adapter = this.chain.adapter(org);
    const caps = adapter.getCapabilities();
    const serverSigned = caps.signing === 'server-simulated';
    if (!serverSigned && !txHash) throw badRequest('TX_REQUIRED', 'Sign the execution in your wallet and send the transaction hash');
    if (serverSigned && txHash) throw badRequest('TX_NOT_EXPECTED', 'Simulated execution is submitted by Veyra');

    const executionId = await this.db.transaction(async (tx) => {
      const row = await this.findBatch(tx, orgId, batchId, true);
      const status = row.status as BatchStatus;
      if (!canTransition(status, 'EXECUTING')) throw conflict('INVALID_STATE', `A ${status} batch cannot be executed`);
      // Re-check approvals at execution time: membership may have changed.
      const evaluation = await this.evaluate(tx, org, row);
      if (!evaluation.satisfied) throw conflict('NOT_APPROVED', `Needs ${evaluation.required} approvals, has ${evaluation.confirmed}`);
      const attempts = await tx
        .select({ n: max(schema.executions.attempt) })
        .from(schema.executions)
        .where(eq(schema.executions.batchId, batchId));
      const attempt = (attempts[0]?.n ?? 0) + 1;
      const [execution] = await tx
        .insert(schema.executions)
        .values({ batchId, attempt, status: 'SUBMITTED', txHash: txHash ?? null, submittedBy: member.id })
        .returning();
      await tx
        .update(schema.payrollBatches)
        .set({ status: 'EXECUTING', updatedAt: new Date() })
        .where(eq(schema.payrollBatches.id, batchId));
      await this.upsertPayments(tx, batchId, 'SUBMITTED', txHash ?? null);
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.ExecutionSubmitted,
        entityType: 'batch',
        entityId: batchId,
        data: { executionId: execution!.id, attempt, txHash: txHash ?? null },
      });
      return execution!.id;
    });

    if (serverSigned) {
      try {
        const row = await this.findBatch(this.db, orgId, batchId);
        const plan = await this.planFor(this.db, org, row);
        const ref = await adapter.submitTransaction({ kind: 'execute', plan });
        await this.db.transaction(async (tx) => {
          await tx.update(schema.executions).set({ txHash: ref.txHash }).where(eq(schema.executions.id, executionId));
          await tx.update(schema.payments).set({ txHash: ref.txHash, updatedAt: new Date() }).where(eq(schema.payments.batchId, batchId));
        });
      } catch (err) {
        await this.applyExecutionResult(executionId, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          verification: null,
        });
        throw err;
      }
    }
    await this.monitor.enqueue({ kind: 'execution', id: executionId });
    return this.detail(ctx, await this.findBatch(this.db, orgId, batchId));
  }

  private async upsertPayments(tx: Tx, batchId: string, status: 'SUBMITTED', txHash: string | null) {
    const items = await tx.select({ id: schema.payrollItems.id }).from(schema.payrollItems).where(eq(schema.payrollItems.batchId, batchId));
    for (const item of items) {
      await tx
        .insert(schema.payments)
        .values({ batchId, itemId: item.id, status, txHash, verified: false })
        .onConflictDoUpdate({ target: schema.payments.itemId, set: { status, txHash, verified: false, updatedAt: new Date() } });
    }
  }

  async cancel(userId: string, orgId: string, batchId: string, reason: string | undefined) {
    const ctx = await this.access.require(userId, orgId, 'batches:write');
    const adapter = this.chain.adapter(ctx.org);
    let onchainCancel: UnsignedTransaction | null = null;
    await this.db.transaction(async (tx) => {
      const row = await this.findBatch(tx, orgId, batchId, true);
      assertBatchTransition(row.status as BatchStatus, 'CANCELLED');
      await tx
        .update(schema.payrollBatches)
        .set({ status: 'CANCELLED', cancelReason: reason ?? null, updatedAt: new Date() })
        .where(eq(schema.payrollBatches.id, batchId));
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.BatchCancelled,
        entityType: 'batch',
        entityId: batchId,
        data: { from: row.status, reason: reason ?? null },
      });
      if (row.proposalStatus === 'CONFIRMED' && adapter.getCapabilities().requiresProposal) {
        onchainCancel = adapter.buildCancellation(await this.planFor(tx, ctx.org, row));
      }
    });
    const batch = await this.detail(ctx, await this.findBatch(this.db, orgId, batchId));
    // The batch is registered on-chain; cancelling it there stops anyone executing it directly.
    return { batch, onchainCancel };
  }

  /** Unsigned transaction for the wallet to sign for the next step. */
  async chainAction(userId: string, orgId: string, batchId: string, kind: TransactionKind): Promise<UnsignedTransaction> {
    const permission = kind === 'approve' ? 'batches:approve' : kind === 'execute' ? 'batches:execute' : 'batches:write';
    const { org } = await this.access.require(userId, orgId, permission);
    const adapter = this.chain.adapter(org);
    const row = await this.findBatch(this.db, orgId, batchId);
    const expected: Record<TransactionKind, BatchStatus[]> = {
      propose: ['PENDING_APPROVAL'],
      approve: ['PENDING_APPROVAL'],
      execute: ['APPROVED', 'FAILED'],
      cancel: ['CANCELLED', 'PENDING_APPROVAL', 'APPROVED', 'FAILED'],
    };
    if (!expected[kind].includes(row.status as BatchStatus)) {
      throw conflict('INVALID_STATE', `No ${kind} action for a ${row.status} batch`);
    }
    const plan = await this.planFor(this.db, org, row);
    const tx =
      kind === 'propose'
        ? adapter.buildProposal(plan)
        : kind === 'approve'
          ? adapter.buildApproval(plan)
          : kind === 'execute'
            ? adapter.createPayment(plan)
            : adapter.buildCancellation(plan);
    if (!tx) throw badRequest('NOT_REQUIRED', `This execution mode has no on-chain ${kind} step`);
    return tx;
  }

  /** Re-check every pending transaction of a batch (after restarts or timeouts). */
  async reconcile(userId: string, orgId: string, batchId: string): Promise<{ enqueued: number }> {
    await this.access.require(userId, orgId, 'batches:read');
    const row = await this.findBatch(this.db, orgId, batchId);
    return { enqueued: await this.enqueuePending(row.id) };
  }

  async enqueuePending(batchId?: string): Promise<number> {
    let n = 0;
    const proposals = await this.db
      .select({ id: schema.payrollBatches.id })
      .from(schema.payrollBatches)
      .where(
        batchId
          ? and(eq(schema.payrollBatches.id, batchId), eq(schema.payrollBatches.proposalStatus, 'PENDING'))
          : eq(schema.payrollBatches.proposalStatus, 'PENDING'),
      );
    for (const p of proposals) {
      await this.monitor.enqueue({ kind: 'proposal', id: p.id });
      n++;
    }
    const approvalRows = await this.db
      .select({ id: schema.approvals.id })
      .from(schema.approvals)
      .where(
        batchId
          ? and(eq(schema.approvals.batchId, batchId), eq(schema.approvals.status, 'PENDING_CHAIN'))
          : eq(schema.approvals.status, 'PENDING_CHAIN'),
      );
    for (const a of approvalRows) {
      await this.monitor.enqueue({ kind: 'approval', id: a.id });
      n++;
    }
    const executionRows = await this.db
      .select({ id: schema.executions.id })
      .from(schema.executions)
      .where(
        batchId
          ? and(eq(schema.executions.batchId, batchId), eq(schema.executions.status, 'SUBMITTED'))
          : eq(schema.executions.status, 'SUBMITTED'),
      );
    for (const e of executionRows) {
      await this.monitor.enqueue({ kind: 'execution', id: e.id });
      n++;
    }
    return n;
  }

  // ---- Results from the transaction monitor ----------------------------------

  async loadForJob(batchId: string) {
    const row = await this.db.query.payrollBatches.findFirst({ where: eq(schema.payrollBatches.id, batchId) });
    if (!row) return null;
    const org = await this.db.query.organisations.findFirst({ where: eq(schema.organisations.id, row.organisationId) });
    if (!org) return null;
    return { row, org, adapter: this.chain.adapter(org), plan: () => this.planFor(this.db, org, row) };
  }

  async applyProposalResult(batchId: string, result: VerificationResult & { error?: string }) {
    await this.db.transaction(async (tx) => {
      const row = await tx.query.payrollBatches.findFirst({ where: eq(schema.payrollBatches.id, batchId) });
      if (!row || row.proposalStatus !== 'PENDING') return;
      const ok = result.verified;
      const error = ok ? null : (result.error ?? result.mismatches.join('; '));
      await tx
        .update(schema.payrollBatches)
        .set({ proposalStatus: ok ? 'CONFIRMED' : 'FAILED', proposalError: error, updatedAt: new Date() })
        .where(eq(schema.payrollBatches.id, batchId));
      await this.audit.append(tx, {
        organisationId: row.organisationId,
        actorId: null,
        action: ok ? AuditActions.BatchProposalConfirmed : AuditActions.BatchProposalFailed,
        entityType: 'batch',
        entityId: batchId,
        data: { txHash: row.proposalTxHash, error },
      });
    });
  }

  async loadApprovalForJob(approvalId: string) {
    const approval = await this.db.query.approvals.findFirst({ where: eq(schema.approvals.id, approvalId) });
    if (!approval) return null;
    const ctx = await this.loadForJob(approval.batchId);
    return ctx ? { ...ctx, approval } : null;
  }

  async applyApprovalResult(approvalId: string, result: VerificationResult & { error?: string }) {
    await this.db.transaction(async (tx) => {
      const approval = await tx.query.approvals.findFirst({ where: eq(schema.approvals.id, approvalId) });
      if (!approval || approval.status !== 'PENDING_CHAIN') return;
      const row = await this.lockBatchById(tx, approval.batchId);
      const org = await tx.query.organisations.findFirst({ where: eq(schema.organisations.id, row.organisationId) });
      const ok = result.verified;
      const error = ok ? null : (result.error ?? result.mismatches.join('; '));
      await tx
        .update(schema.approvals)
        .set({ status: ok ? 'CONFIRMED' : 'FAILED', error, confirmedAt: ok ? new Date() : null })
        .where(eq(schema.approvals.id, approvalId));
      await this.audit.append(tx, {
        organisationId: row.organisationId,
        actorId: null,
        action: ok ? AuditActions.ApprovalConfirmed : AuditActions.ApprovalFailed,
        entityType: 'batch',
        entityId: row.id,
        data: { approvalId, memberId: approval.memberId, txHash: approval.txHash, error },
      });
      if (ok) await this.promoteIfApproved(tx, org!, row, null);
    });
  }

  async loadExecutionForJob(executionId: string) {
    const execution = await this.db.query.executions.findFirst({ where: eq(schema.executions.id, executionId) });
    if (!execution) return null;
    const ctx = await this.loadForJob(execution.batchId);
    return ctx ? { ...ctx, execution } : null;
  }

  async applyExecutionResult(
    executionId: string,
    result: { ok: boolean; error: string | null; verification: PaymentVerification | null },
  ) {
    await this.db.transaction(async (tx) => {
      const execution = await tx.query.executions.findFirst({ where: eq(schema.executions.id, executionId) });
      if (!execution || execution.status !== 'SUBMITTED') return;
      const row = await this.lockBatchById(tx, execution.batchId);
      const now = new Date();
      await tx
        .update(schema.executions)
        .set({
          status: result.ok ? 'CONFIRMED' : 'FAILED',
          error: result.error,
          verification: result.verification,
          finalisedAt: now,
        })
        .where(eq(schema.executions.id, executionId));
      await tx
        .update(schema.payments)
        .set({
          status: result.ok ? 'CONFIRMED' : 'FAILED',
          verified: result.ok && (result.verification?.verified ?? false),
          updatedAt: now,
        })
        .where(eq(schema.payments.batchId, row.id));
      const next: BatchStatus = result.ok ? 'COMPLETED' : 'FAILED';
      assertBatchTransition(row.status as BatchStatus, next);
      await tx
        .update(schema.payrollBatches)
        .set({ status: next, completedAt: result.ok ? now : null, updatedAt: now })
        .where(eq(schema.payrollBatches.id, row.id));
      await this.audit.append(tx, {
        organisationId: row.organisationId,
        actorId: null,
        action: result.ok ? AuditActions.ExecutionConfirmed : AuditActions.ExecutionFailed,
        entityType: 'batch',
        entityId: row.id,
        data: {
          executionId,
          txHash: execution.txHash,
          error: result.error,
          verified: result.verification?.verified ?? false,
          method: result.verification?.method ?? null,
        },
      });
      if (result.ok) {
        await this.audit.append(tx, {
          organisationId: row.organisationId,
          actorId: null,
          action: AuditActions.BatchCompleted,
          entityType: 'batch',
          entityId: row.id,
          data: { total: row.total, itemCount: row.itemCount },
        });
      }
    });
  }

  // ---- Receipts --------------------------------------------------------------

  async receipt(userId: string, orgId: string, batchId: string): Promise<Receipt> {
    const ctx = await this.access.require(userId, orgId, 'contractors:read');
    const { org } = ctx;
    const detail = await this.detail(ctx, await this.findBatch(this.db, orgId, batchId));
    const caps = this.chain.capabilities(org);
    const trail = await this.audit.list(orgId, { limit: 200, entityId: batchId });
    const lastExecution = detail.executions?.at(-1) ?? null;
    const paymentsByItem = new Map((detail.payments ?? []).map((p) => [p.itemId, p]));
    await this.db.transaction((tx) =>
      this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.ReceiptExported,
        entityType: 'batch',
        entityId: batchId,
      }),
    );
    return {
      receiptVersion: 1,
      generatedAt: new Date().toISOString(),
      organisation: { id: org.id, name: org.name },
      batch: {
        id: detail.id,
        title: detail.title,
        status: detail.status,
        executionMode: detail.executionMode,
        chain: org.chain as Receipt['batch']['chain'],
        network: org.network,
        asset: detail.asset,
        total: detail.total,
        commitment: detail.commitment,
        chainBatchId: detail.chainBatchId,
        chainItemsHash: detail.chainItemsHash,
        treasuryAddress: (await this.findBatch(this.db, orgId, batchId)).treasuryAddress,
      },
      items: (detail.items ?? []).map((i) => {
        const p = paymentsByItem.get(i.id);
        return {
          recipient: i.recipient,
          contractorName: i.contractorName,
          amount: i.amount,
          status: p?.status ?? 'PENDING',
          txHash: p?.txHash ?? null,
        };
      }),
      approvals: (detail.approvals ?? []).map((a) => ({
        memberName: a.memberName,
        status: a.status,
        txHash: a.txHash,
        confirmedAt: a.confirmedAt,
      })),
      execution: lastExecution,
      privacy: caps.privacy,
      auditTrail: trail
        .reverse()
        .map((e) => ({ seq: e.seq, action: e.action, createdAt: e.createdAt, hash: e.hash })),
    };
  }

  // ---- Helpers -----------------------------------------------------------------

  async findBatch(db: Executor, orgId: string, batchId: string, lock = false): Promise<BatchRow> {
    if (!isUuid(batchId)) throw notFound('Batch');
    const query = db
      .select()
      .from(schema.payrollBatches)
      .where(and(eq(schema.payrollBatches.organisationId, orgId), eq(schema.payrollBatches.id, batchId)));
    const rows = lock ? await query.for('update') : await query;
    if (!rows[0]) throw notFound('Batch');
    return rows[0];
  }

  private async lockBatchById(tx: Tx, batchId: string): Promise<BatchRow> {
    const rows = await tx.select().from(schema.payrollBatches).where(eq(schema.payrollBatches.id, batchId)).for('update');
    if (!rows[0]) throw notFound('Batch');
    return rows[0];
  }

  async decodeItems(db: Executor, org: OrgRow, batchId: string): Promise<DecodedItem[]> {
    const rows = await db
      .select({ item: schema.payrollItems, nameEnc: schema.contractors.nameEnc })
      .from(schema.payrollItems)
      .innerJoin(schema.contractors, eq(schema.contractors.id, schema.payrollItems.contractorId))
      .where(eq(schema.payrollItems.batchId, batchId))
      .orderBy(asc(schema.payrollItems.position));
    const d = (purpose: string, v: string) => this.crypto.decrypt(org.id, org.dataKeyEnc, purpose, v);
    return rows.map(({ item, nameEnc }) => ({
      id: item.id,
      contractorId: item.contractorId,
      contractorName: d(Purpose.ContractorName, nameEnc),
      position: item.position,
      recipient: item.recipientEnc ? d(Purpose.ItemRecipient, item.recipientEnc) : null,
      amount: BigInt(d(Purpose.ItemAmount, item.amountEnc)),
    }));
  }

  private buildPlan(row: BatchRow, treasury: string | null, items: { recipient: string; amount: bigint }[]): BatchPlan {
    return {
      chainBatchId: row.chainBatchId,
      asset: { address: row.assetAddress, symbol: row.assetSymbol, decimals: row.assetDecimals },
      treasuryAddress: treasury,
      items,
      total: items.reduce((a, i) => a + i.amount, 0n),
    };
  }

  /** Plan from the frozen snapshot taken at submission. */
  async planFor(db: Executor, org: OrgRow, row: BatchRow): Promise<BatchPlan> {
    const items = await this.decodeItems(db, org, row.id);
    return this.buildPlan(
      row,
      row.treasuryAddress,
      items.map((i) => ({ recipient: i.recipient ?? '', amount: i.amount })),
    );
  }
}

function approvalMessage(code: string): string {
  switch (code) {
    case 'NOT_APPROVER':
      return 'Your role cannot approve batches';
    case 'CREATOR_CANNOT_APPROVE':
      return 'The organisation policy does not allow the batch creator to approve it';
    case 'ALREADY_APPROVED':
      return 'You have already approved this batch';
    default:
      return 'This batch is not awaiting approval';
  }
}
