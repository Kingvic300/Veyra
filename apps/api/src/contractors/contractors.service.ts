import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  AuditActions,
  type Contractor,
  type CreateContractorInput,
  type UpdateContractorInput,
} from '@veyra/core';
import { DB, schema, type Db } from '../db/database.js';
import { AccessService, isUuid, type OrgRow } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ChainService } from '../chain/chain.service.js';
import { EncryptionService } from '../common/encryption.service.js';
import { notFound } from '../common/errors.js';

export type ContractorRow = typeof schema.contractors.$inferSelect;

/** Field purposes for authenticated encryption (bound into the AAD). */
export const Purpose = {
  ContractorName: 'contractor.name',
  ContractorEmail: 'contractor.email',
  ContractorPayout: 'contractor.payout',
  ItemRecipient: 'item.recipient',
  ItemAmount: 'item.amount',
} as const;

@Injectable()
export class ContractorsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly chain: ChainService,
    private readonly crypto: EncryptionService,
  ) {}

  decode(org: OrgRow, row: ContractorRow): Contractor {
    const d = (purpose: string, v: string) => this.crypto.decrypt(org.id, org.dataKeyEnc, purpose, v);
    return {
      id: row.id,
      organisationId: row.organisationId,
      name: d(Purpose.ContractorName, row.nameEnc),
      email: row.emailEnc ? d(Purpose.ContractorEmail, row.emailEnc) : null,
      country: row.country,
      payoutAddress: d(Purpose.ContractorPayout, row.payoutAddressEnc),
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(userId: string, orgId: string, includeArchived: boolean): Promise<Contractor[]> {
    const { org } = await this.access.require(userId, orgId, 'contractors:read');
    const conditions = [eq(schema.contractors.organisationId, orgId)];
    if (!includeArchived) conditions.push(eq(schema.contractors.active, true));
    const rows = await this.db
      .select()
      .from(schema.contractors)
      .where(and(...conditions))
      .orderBy(schema.contractors.createdAt);
    return rows.map((r) => this.decode(org, r));
  }

  async get(userId: string, orgId: string, contractorId: string): Promise<Contractor> {
    const { org } = await this.access.require(userId, orgId, 'contractors:read');
    return this.decode(org, await this.find(orgId, contractorId));
  }

  async create(userId: string, orgId: string, input: CreateContractorInput): Promise<Contractor> {
    const { org } = await this.access.require(userId, orgId, 'contractors:write');
    const payout = this.chain.adapter(org).normaliseAddress(input.payoutAddress);
    const e = (purpose: string, v: string) => this.crypto.encrypt(org.id, org.dataKeyEnc, purpose, v);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.contractors)
        .values({
          organisationId: orgId,
          nameEnc: e(Purpose.ContractorName, input.name),
          emailEnc: input.email ? e(Purpose.ContractorEmail, input.email) : null,
          country: input.country ?? null,
          payoutAddressEnc: e(Purpose.ContractorPayout, payout),
        })
        .returning();
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.ContractorCreated,
        entityType: 'contractor',
        entityId: row!.id,
        data: { country: input.country ?? null },
      });
      return this.decode(org, row!);
    });
  }

  async update(userId: string, orgId: string, contractorId: string, input: UpdateContractorInput): Promise<Contractor> {
    const { org } = await this.access.require(userId, orgId, 'contractors:write');
    await this.find(orgId, contractorId);
    const e = (purpose: string, v: string) => this.crypto.encrypt(org.id, org.dataKeyEnc, purpose, v);
    const patch: Partial<typeof schema.contractors.$inferInsert> = { updatedAt: new Date() };
    const changed: string[] = [];
    if (input.name !== undefined) {
      patch.nameEnc = e(Purpose.ContractorName, input.name);
      changed.push('name');
    }
    if (input.email !== undefined) {
      patch.emailEnc = input.email ? e(Purpose.ContractorEmail, input.email) : null;
      changed.push('email');
    }
    if (input.country !== undefined) {
      patch.country = input.country;
      changed.push('country');
    }
    if (input.payoutAddress !== undefined) {
      patch.payoutAddressEnc = e(Purpose.ContractorPayout, this.chain.adapter(org).normaliseAddress(input.payoutAddress));
      changed.push('payoutAddress');
    }
    if (input.active !== undefined) {
      patch.active = input.active;
      changed.push('active');
    }
    return this.db.transaction(async (tx) => {
      const [row] = await tx.update(schema.contractors).set(patch).where(eq(schema.contractors.id, contractorId)).returning();
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: input.active === false ? AuditActions.ContractorArchived : AuditActions.ContractorUpdated,
        entityType: 'contractor',
        entityId: contractorId,
        // Record which fields changed, never their values.
        data: { changed },
      });
      return this.decode(org, row!);
    });
  }

  async archive(userId: string, orgId: string, contractorId: string): Promise<Contractor> {
    return this.update(userId, orgId, contractorId, { active: false });
  }

  private async find(orgId: string, contractorId: string): Promise<ContractorRow> {
    if (!isUuid(contractorId)) throw notFound('Contractor');
    const row = await this.db.query.contractors.findFirst({
      where: and(eq(schema.contractors.organisationId, orgId), eq(schema.contractors.id, contractorId)),
    });
    if (!row) throw notFound('Contractor');
    return row;
  }
}
