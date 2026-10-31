import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  AuditActions,
  canAssignRole,
  formatUnits,
  type AddMemberInput,
  type CreateOrganisationInput,
  type Member,
  type Organisation,
  type Treasury,
  type UpdateMemberInput,
  type UpdateOrganisationInput,
} from '@veyra/core';
import type { ChainAdapter } from '@veyra/chain-adapter';
import { DB, schema, type Db, type Tx } from '../db/database.js';
import { AccessService, isUuid, type OrgRow } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ChainService } from '../chain/chain.service.js';
import { EncryptionService } from '../common/encryption.service.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { toMember, toOrganisation } from './mappers.js';

/** Batch statuses whose totals are committed but not yet paid out. */
export const COMMITTED_STATUSES = ['APPROVED', 'EXECUTING'] as const;

@Injectable()
export class OrganisationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly chain: ChainService,
    private readonly crypto: EncryptionService,
  ) {}

  networks() {
    return this.chain.networks();
  }

  async create(userId: string, input: CreateOrganisationInput): Promise<Organisation> {
    this.chain.assertSupported(input.chain, input.network, input.executionMode);
    const adapter = this.chain.adapter(input);
    const assetAddress = adapter.normaliseAddress(input.asset.address);
    const treasuryAddress = input.treasuryAddress ? adapter.normaliseAddress(input.treasuryAddress) : null;
    const id = randomUUID();

    return this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(schema.organisations)
        .values({
          id,
          name: input.name,
          chain: input.chain,
          network: input.network,
          executionMode: input.executionMode,
          treasuryAddress,
          assetAddress,
          assetSymbol: input.asset.symbol,
          assetDecimals: input.asset.decimals,
          approvalThreshold: input.approvalPolicy.threshold,
          allowCreatorApproval: input.approvalPolicy.allowCreatorApproval,
          maxBatchTotal: input.approvalPolicy.maxBatchTotal,
          dataKeyEnc: this.crypto.newWrappedDataKey(id),
        })
        .returning();
      const [member] = await tx.insert(schema.members).values({ organisationId: id, userId, role: 'OWNER' }).returning();
      await this.audit.append(tx, {
        organisationId: id,
        actorId: userId,
        action: AuditActions.OrganisationCreated,
        entityType: 'organisation',
        entityId: id,
        data: {
          chain: input.chain,
          network: input.network,
          executionMode: input.executionMode,
          asset: assetAddress,
          treasuryAddress,
          threshold: input.approvalPolicy.threshold,
        },
      });
      await this.audit.append(tx, {
        organisationId: id,
        actorId: userId,
        action: AuditActions.MemberAdded,
        entityType: 'member',
        entityId: member!.id,
        data: { role: 'OWNER' },
      });
      return toOrganisation(org!);
    });
  }

  async list(userId: string): Promise<(Organisation & { role: Member['role'] })[]> {
    const rows = await this.db
      .select({ org: schema.organisations, role: schema.members.role })
      .from(schema.members)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.members.organisationId))
      .where(eq(schema.members.userId, userId))
      .orderBy(schema.organisations.createdAt);
    return rows.map((r) => ({ ...toOrganisation(r.org), role: r.role as Member['role'] }));
  }

  async get(userId: string, orgId: string): Promise<Organisation & { role: Member['role']; memberId: string }> {
    const { org, member } = await this.access.require(userId, orgId, 'org:read');
    return { ...toOrganisation(org), role: member.role, memberId: member.id };
  }

  async update(userId: string, orgId: string, input: UpdateOrganisationInput): Promise<Organisation> {
    const { org } = await this.access.require(userId, orgId, 'org:manage');
    const adapter = this.chain.adapter(org);
    const patch: Partial<typeof schema.organisations.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.treasuryAddress !== undefined) {
      patch.treasuryAddress = input.treasuryAddress ? adapter.normaliseAddress(input.treasuryAddress) : null;
    }
    if (input.approvalPolicy) {
      patch.approvalThreshold = input.approvalPolicy.threshold;
      patch.allowCreatorApproval = input.approvalPolicy.allowCreatorApproval;
      patch.maxBatchTotal = input.approvalPolicy.maxBatchTotal;
    }
    return this.db.transaction(async (tx) => {
      const [row] = await tx.update(schema.organisations).set(patch).where(eq(schema.organisations.id, orgId)).returning();
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.OrganisationUpdated,
        entityType: 'organisation',
        entityId: orgId,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(patch.treasuryAddress !== undefined && { treasuryAddress: patch.treasuryAddress }),
          ...(input.approvalPolicy && { approvalPolicy: input.approvalPolicy }),
        },
      });
      return toOrganisation(row!);
    });
  }

  async capabilities(userId: string, orgId: string) {
    const { org } = await this.access.require(userId, orgId, 'org:read');
    return this.chain.capabilities(org);
  }

  async treasury(userId: string, orgId: string): Promise<Treasury> {
    const { org } = await this.access.require(userId, orgId, 'treasury:read');
    const adapter = this.chain.adapter(org);
    return this.treasuryFor(org, adapter);
  }

  async treasuryFor(org: OrgRow, adapter: ChainAdapter): Promise<Treasury> {
    const committedRows = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.payrollBatches.total}), 0)::text` })
      .from(schema.payrollBatches)
      .where(and(eq(schema.payrollBatches.organisationId, org.id), inArray(schema.payrollBatches.status, [...COMMITTED_STATUSES])));
    const committed = BigInt(committedRows[0]?.total ?? '0');
    const asset = { address: org.assetAddress, symbol: org.assetSymbol, decimals: org.assetDecimals };
    const base = {
      organisationId: org.id,
      chain: org.chain as Treasury['chain'],
      network: org.network,
      address: org.treasuryAddress,
      asset,
      committed: committed.toString(),
      privacy: adapter.getCapabilities().privacy,
    };
    if (!org.treasuryAddress) return { ...base, balance: null, available: null, error: 'Treasury address is not configured' };
    try {
      const balance = await adapter.getBalance(org.treasuryAddress, asset);
      return { ...base, balance: balance.toString(), available: (balance - committed).toString() };
    } catch (err) {
      return { ...base, balance: null, available: null, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Human summary used in logs and receipts. */
  describeAmount(org: OrgRow, units: bigint | string): string {
    return `${formatUnits(units, org.assetDecimals)} ${org.assetSymbol}`;
  }

  // ---- Members -----------------------------------------------------------

  async listMembers(userId: string, orgId: string): Promise<Member[]> {
    await this.access.require(userId, orgId, 'org:read');
    const rows = await this.db
      .select({ member: schema.members, user: { email: schema.users.email, name: schema.users.name } })
      .from(schema.members)
      .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
      .where(eq(schema.members.organisationId, orgId))
      .orderBy(schema.members.createdAt);
    return rows.map((r) => toMember(r.member, r.user));
  }

  async addMember(userId: string, orgId: string, input: AddMemberInput): Promise<Member> {
    const { org, member: actor } = await this.access.require(userId, orgId, 'members:manage');
    if (!canAssignRole(actor.role, input.role)) throw forbidden(`Your role cannot assign ${input.role}`);
    const user = await this.db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
    if (!user) throw notFound('User with this email (they must create a Veyra account first)');
    const walletAddress = input.walletAddress ? this.chain.adapter(org).normaliseAddress(input.walletAddress) : null;
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.members.findFirst({
        where: and(eq(schema.members.organisationId, orgId), eq(schema.members.userId, user.id)),
      });
      if (existing) throw conflict('ALREADY_MEMBER', 'This user is already a member');
      const [row] = await tx
        .insert(schema.members)
        .values({ organisationId: orgId, userId: user.id, role: input.role, walletAddress })
        .returning();
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.MemberAdded,
        entityType: 'member',
        entityId: row!.id,
        data: { role: input.role, walletAddress },
      });
      return toMember(row!, user);
    });
  }

  async updateMember(userId: string, orgId: string, memberId: string, input: UpdateMemberInput): Promise<Member> {
    const { org, member: actor } = await this.access.require(userId, orgId, 'org:read');
    const target = await this.findMember(orgId, memberId);
    const selfWalletOnly = target.id === actor.id && input.role === undefined;
    if (!selfWalletOnly) {
      if (!canAssignRole(actor.role, (input.role ?? target.role) as Member['role'])) throw forbidden();
      if (target.role === 'OWNER' && actor.role !== 'OWNER') throw forbidden('Only owners can change owners');
    }
    const patch: Partial<typeof schema.members.$inferInsert> = {};
    if (input.role !== undefined) patch.role = input.role;
    if (input.walletAddress !== undefined) {
      patch.walletAddress = input.walletAddress ? this.chain.adapter(org).normaliseAddress(input.walletAddress) : null;
    }
    if (Object.keys(patch).length === 0) throw badRequest('EMPTY_UPDATE', 'Nothing to update');

    return this.db.transaction(async (tx) => {
      if (target.role === 'OWNER' && patch.role && patch.role !== 'OWNER') await this.assertAnotherOwner(tx, orgId, target.id);
      const [row] = await tx.update(schema.members).set(patch).where(eq(schema.members.id, memberId)).returning();
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.MemberUpdated,
        entityType: 'member',
        entityId: memberId,
        data: patch,
      });
      const user = await tx.query.users.findFirst({ where: eq(schema.users.id, row!.userId) });
      return toMember(row!, user!);
    });
  }

  async removeMember(userId: string, orgId: string, memberId: string): Promise<void> {
    const { member: actor } = await this.access.require(userId, orgId, 'members:manage');
    const target = await this.findMember(orgId, memberId);
    if (target.role === 'OWNER' && actor.role !== 'OWNER') throw forbidden('Only owners can remove owners');
    await this.db.transaction(async (tx) => {
      if (target.role === 'OWNER') await this.assertAnotherOwner(tx, orgId, target.id);
      await tx.delete(schema.members).where(eq(schema.members.id, memberId));
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.MemberRemoved,
        entityType: 'member',
        entityId: memberId,
        data: { role: target.role },
      });
    });
  }

  private async findMember(orgId: string, memberId: string) {
    if (!isUuid(memberId)) throw notFound('Member');
    const row = await this.db.query.members.findFirst({
      where: and(eq(schema.members.organisationId, orgId), eq(schema.members.id, memberId)),
    });
    if (!row) throw notFound('Member');
    return row;
  }

  private async assertAnotherOwner(tx: Tx, orgId: string, exceptId: string) {
    const owners = await tx
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(and(eq(schema.members.organisationId, orgId), eq(schema.members.role, 'OWNER')))
      .for('update');
    if (!owners.some((o) => o.id !== exceptId)) throw conflict('LAST_OWNER', 'An organisation must keep at least one owner');
  }
}
