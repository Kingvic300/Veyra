import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { can, type Permission, type Role } from '@veyra/core';
import { DB, schema, type Db, type Executor } from '../db/database.js';
import { forbidden, notFound } from '../common/errors.js';

export type OrgRow = typeof schema.organisations.$inferSelect;
export type MemberRow = typeof schema.members.$inferSelect & { role: Role };

export interface AccessContext {
  org: OrgRow;
  member: MemberRow;
}

@Injectable()
export class AccessService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Resolve the caller's membership and enforce a permission. Non-members get
   * 404 (not 403) so organisation ids cannot be probed.
   */
  async require(userId: string, orgId: string, permission: Permission, db: Executor = this.db): Promise<AccessContext> {
    if (!isUuid(orgId)) throw notFound('Organisation');
    const rows = await db
      .select({ org: schema.organisations, member: schema.members })
      .from(schema.members)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.members.organisationId))
      .where(and(eq(schema.members.organisationId, orgId), eq(schema.members.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound('Organisation');
    const member = row.member as MemberRow;
    if (!can(member.role, permission)) throw forbidden(`Your role (${member.role}) cannot perform ${permission}`);
    return { org: row.org, member };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
