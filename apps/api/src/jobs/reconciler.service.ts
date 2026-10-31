import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { isFinalState, type TransactionRef, type TransactionStatus } from '@veyra/chain-adapter';
import { BatchesService } from '../batches/batches.service.js';
import { TxMonitor, type ChainJob, type ChainJobOutcome } from './tx-monitor.js';

/**
 * Turns chain transaction status into batch state. Every handler is
 * idempotent: it re-reads the row and does nothing if the job already ran.
 */
@Injectable()
export class ReconcilerService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Reconciler');

  constructor(
    private readonly monitor: TxMonitor,
    private readonly batches: BatchesService,
  ) {}

  async onApplicationBootstrap() {
    this.monitor.setHandler((job) => this.process(job));
    const n = await this.batches.enqueuePending();
    if (n > 0) this.logger.log(`Resumed monitoring of ${n} pending transactions`);
  }

  async process(job: ChainJob): Promise<ChainJobOutcome> {
    switch (job.kind) {
      case 'proposal':
        return this.proposal(job.id);
      case 'approval':
        return this.approval(job.id);
      case 'execution':
        return this.execution(job.id);
    }
  }

  private async proposal(batchId: string): Promise<ChainJobOutcome> {
    const ctx = await this.batches.loadForJob(batchId);
    if (!ctx || ctx.row.proposalStatus !== 'PENDING' || !ctx.row.proposalTxHash) return 'done';
    const ref = this.ref(ctx.org, ctx.row.proposalTxHash);
    const status = await ctx.adapter.getTransaction(ref);
    if (!isFinalState(status.state)) return 'retry';
    if (status.state !== 'FINALISED') {
      await this.batches.applyProposalResult(batchId, failed(status));
      return 'done';
    }
    await this.batches.applyProposalResult(batchId, await ctx.adapter.verifyProposal(ref, await ctx.plan()));
    return 'done';
  }

  private async approval(approvalId: string): Promise<ChainJobOutcome> {
    const ctx = await this.batches.loadApprovalForJob(approvalId);
    if (!ctx || ctx.approval.status !== 'PENDING_CHAIN' || !ctx.approval.txHash) return 'done';
    const ref = this.ref(ctx.org, ctx.approval.txHash);
    const status = await ctx.adapter.getTransaction(ref);
    if (!isFinalState(status.state)) return 'retry';
    if (status.state !== 'FINALISED') {
      await this.batches.applyApprovalResult(approvalId, failed(status));
      return 'done';
    }
    if (!ctx.approval.walletAddress) {
      await this.batches.applyApprovalResult(approvalId, { verified: false, details: [], mismatches: ['No approver wallet recorded'] });
      return 'done';
    }
    const result = await ctx.adapter.verifyApproval(ref, await ctx.plan(), ctx.approval.walletAddress);
    await this.batches.applyApprovalResult(approvalId, result);
    return 'done';
  }

  private async execution(executionId: string): Promise<ChainJobOutcome> {
    const ctx = await this.batches.loadExecutionForJob(executionId);
    if (!ctx || ctx.execution.status !== 'SUBMITTED') return 'done';
    // Simulated execution writes the hash right after submission.
    if (!ctx.execution.txHash) return 'retry';
    const ref = this.ref(ctx.org, ctx.execution.txHash);
    const status = await ctx.adapter.getTransaction(ref);
    if (!isFinalState(status.state)) return 'retry';
    if (status.state !== 'FINALISED') {
      await this.batches.applyExecutionResult(executionId, {
        ok: false,
        error: status.error ?? `Transaction ${status.state.toLowerCase()}`,
        verification: null,
      });
      return 'done';
    }
    const verification = await ctx.adapter.verifyPayment(ref, await ctx.plan());
    await this.batches.applyExecutionResult(executionId, {
      ok: verification.verified,
      // A successful transaction that does not pay this batch is treated as a
      // failed attempt; the contract still prevents any double payment.
      error: verification.verified ? null : `Verification failed: ${verification.mismatches.join('; ')}`,
      verification,
    });
    return 'done';
  }

  private ref(org: { chain: string; network: string }, txHash: string): TransactionRef {
    return { chain: org.chain as TransactionRef['chain'], network: org.network, txHash };
  }
}

function failed(status: TransactionStatus) {
  const error = status.error ?? `Transaction ${status.state.toLowerCase()}`;
  return { verified: false, details: [], mismatches: [error], error };
}
