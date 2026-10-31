import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { can, type ContractorEarnings, type MonthlySpend, type OrganisationStats } from '@veyra/core';
import { DB, schema, type Db } from '../db/database.js';
import { AccessService } from '../access/access.service.js';
import { EncryptionService } from '../common/encryption.service.js';
import { Purpose } from '../contractors/contractors.service.js';

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Aggregates for the dashboard. Computed on read from the source tables, so
 * they can never drift from the batches themselves. Per-contractor and
 * per-country figures are limited to roles that may read contractor records.
 */
@Injectable()
export class StatsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessService,
    private readonly crypto: EncryptionService,
  ) {}

  async stats(userId: string, orgId: string, now = new Date()): Promise<OrganisationStats> {
    const { org, member } = await this.access.require(userId, orgId, 'batches:read');
    const batches = await this.db.select().from(schema.payrollBatches).where(eq(schema.payrollBatches.organisationId, orgId));
    const completed = batches.filter((b) => b.status === 'COMPLETED' && b.completedAt);
    const sum = (rows: typeof batches) => rows.reduce((a, b) => a + BigInt(b.total), 0n);

    const thisMonth = monthKey(now);
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastMonth = monthKey(last);

    const monthly: MonthlySpend[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = monthKey(d);
      const rows = completed.filter((b) => monthKey(b.completedAt!) === key);
      monthly.push({ month: key, total: sum(rows).toString(), batches: rows.length, payments: rows.reduce((a, b) => a + b.itemCount, 0) });
    }

    // Approval turnaround: submission to the last confirming approval.
    const approvedIds = batches.filter((b) => b.submittedAt && ['APPROVED', 'EXECUTING', 'COMPLETED', 'FAILED'].includes(b.status)).map((b) => b.id);
    const approvalRows = approvedIds.length
      ? await this.db
          .select({ batchId: schema.approvals.batchId, confirmedAt: schema.approvals.confirmedAt })
          .from(schema.approvals)
          .where(and(inArray(schema.approvals.batchId, approvedIds), eq(schema.approvals.status, 'CONFIRMED')))
      : [];
    const lastApproval = new Map<string, number>();
    for (const a of approvalRows) {
      if (!a.confirmedAt) continue;
      lastApproval.set(a.batchId, Math.max(lastApproval.get(a.batchId) ?? 0, a.confirmedAt.getTime()));
    }
    const approvalHours = batches
      .filter((b) => b.submittedAt && lastApproval.has(b.id))
      .map((b) => (lastApproval.get(b.id)! - b.submittedAt!.getTime()) / 3_600_000);

    const executions = batches.length
      ? await this.db
          .select()
          .from(schema.executions)
          .where(and(inArray(schema.executions.batchId, batches.map((b) => b.id)), eq(schema.executions.status, 'CONFIRMED')))
      : [];
    const settleSeconds = executions.filter((e) => e.finalisedAt).map((e) => (e.finalisedAt!.getTime() - e.createdAt.getTime()) / 1000);

    const activeContractors = (
      await this.db
        .select({ id: schema.contractors.id })
        .from(schema.contractors)
        .where(and(eq(schema.contractors.organisationId, orgId), eq(schema.contractors.active, true)))
    ).length;

    let byCountry: OrganisationStats['byCountry'] = null;
    let contractors: ContractorEarnings[] | null = null;
    if (can(member.role, 'contractors:read')) {
      const since = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
      const recentCompleted = completed.filter((b) => b.completedAt! >= since);
      const items = recentCompleted.length
        ? await this.db
            .select({ item: schema.payrollItems, contractor: schema.contractors })
            .from(schema.payrollItems)
            .innerJoin(schema.contractors, eq(schema.contractors.id, schema.payrollItems.contractorId))
            .where(inArray(schema.payrollItems.batchId, recentCompleted.map((b) => b.id)))
        : [];
      const completedAt = new Map(recentCompleted.map((b) => [b.id, b.completedAt!]));
      const perContractor = new Map<string, ContractorEarnings & { totalN: bigint }>();
      const countries = new Map<string, { total: bigint; contractors: Set<string> }>();
      for (const { item, contractor } of items) {
        const amount = BigInt(this.crypto.decrypt(org.id, org.dataKeyEnc, Purpose.ItemAmount, item.amountEnc));
        const paidAt = completedAt.get(item.batchId)!;
        const entry =
          perContractor.get(contractor.id) ??
          {
            contractorId: contractor.id,
            name: this.crypto.decrypt(org.id, org.dataKeyEnc, Purpose.ContractorName, contractor.nameEnc),
            country: contractor.country,
            total: '0',
            totalN: 0n,
            payments: 0,
            lastPaidAt: null,
          };
        entry.totalN += amount;
        entry.payments += 1;
        if (!entry.lastPaidAt || paidAt.toISOString() > entry.lastPaidAt) entry.lastPaidAt = paidAt.toISOString();
        perContractor.set(contractor.id, entry);
        const key = contractor.country ?? 'Unknown';
        const c = countries.get(key) ?? { total: 0n, contractors: new Set<string>() };
        c.total += amount;
        c.contractors.add(contractor.id);
        countries.set(key, c);
      }
      contractors = [...perContractor.values()]
        .sort((a, b) => (b.totalN > a.totalN ? 1 : b.totalN < a.totalN ? -1 : 0))
        .map(({ totalN, ...rest }) => ({ ...rest, total: totalN.toString() }));
      byCountry = [...countries.entries()]
        .map(([country, v]) => ({ country, total: v.total.toString(), contractors: v.contractors.size }))
        .sort((a, b) => (BigInt(b.total) > BigInt(a.total) ? 1 : -1));
    }

    const awaiting = batches.filter((b) => b.status === 'PENDING_APPROVAL');
    const ready = batches.filter((b) => b.status === 'APPROVED');
    return {
      asset: { address: org.assetAddress, symbol: org.assetSymbol, decimals: org.assetDecimals },
      paidAllTime: sum(completed).toString(),
      paidThisMonth: sum(completed.filter((b) => monthKey(b.completedAt!) === thisMonth)).toString(),
      paidLastMonth: sum(completed.filter((b) => monthKey(b.completedAt!) === lastMonth)).toString(),
      completedBatches: completed.length,
      completedPayments: completed.reduce((a, b) => a + b.itemCount, 0),
      activeContractors,
      awaitingApproval: { count: awaiting.length, total: sum(awaiting).toString() },
      readyToPay: { count: ready.length, total: sum(ready).toString() },
      failed: batches.filter((b) => b.status === 'FAILED').length,
      drafts: batches.filter((b) => b.status === 'DRAFT').length,
      monthly,
      medianApprovalHours: median(approvalHours),
      medianSettlementSeconds: median(settleSeconds),
      byCountry,
      contractors,
    };
  }
}

