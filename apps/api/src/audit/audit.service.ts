import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import { GENESIS_HASH, hashAuditEvent, verifyAuditChain, type AuditEvent, type AuditChainResult } from '@veyra/core';
import { DB, schema, type Db, type Executor } from '../db/database.js';

export interface AuditInput {
  organisationId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  /** Never put personal data or decrypted payroll details here. */
  data?: Record<string, unknown>;
}

type Row = typeof schema.auditEvents.$inferSelect;

export function toAuditEvent(row: Row): AuditEvent {
  return {
    id: row.id,
    organisationId: row.organisationId,
    seq: row.seq,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    data: row.data,
    createdAt: row.createdAt,
    prevHash: row.prevHash,
    hash: row.hash,
  };
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Append an event to the organisation's hash chain. Call inside the same
   * transaction as the change it records so both commit or neither does.
   */
  async append(tx: Executor, input: AuditInput): Promise<AuditEvent> {
    // Serialise appends per organisation for the rest of the transaction.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.organisationId}, 0))`);
    const last = await tx
      .select({ seq: schema.auditEvents.seq, hash: schema.auditEvents.hash })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.organisationId, input.organisationId))
      .orderBy(desc(schema.auditEvents.seq))
      .limit(1);
    const body = {
      organisationId: input.organisationId,
      seq: (last[0]?.seq ?? 0) + 1,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      data: input.data ?? {},
      createdAt: new Date().toISOString(),
      prevHash: last[0]?.hash ?? GENESIS_HASH,
    };
    const hash = await hashAuditEvent(body);
    const [row] = await tx.insert(schema.auditEvents).values({ ...body, hash }).returning();
    return toAuditEvent(row!);
  }

  async list(organisationId: string, opts: { limit: number; beforeSeq?: number; entityId?: string }): Promise<AuditEvent[]> {
    const conditions = [eq(schema.auditEvents.organisationId, organisationId)];
    if (opts.beforeSeq) conditions.push(lt(schema.auditEvents.seq, opts.beforeSeq));
    if (opts.entityId) conditions.push(eq(schema.auditEvents.entityId, opts.entityId));
    const rows = await this.db
      .select()
      .from(schema.auditEvents)
      .where(and(...conditions))
      .orderBy(desc(schema.auditEvents.seq))
      .limit(opts.limit);
    return rows.map(toAuditEvent);
  }

  async verify(organisationId: string): Promise<AuditChainResult> {
    const rows = await this.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.organisationId, organisationId))
      .orderBy(asc(schema.auditEvents.seq));
    return verifyAuditChain(rows.map(toAuditEvent));
  }
}
