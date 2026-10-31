import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Columns ending in `_enc` hold AES-256-GCM ciphertext produced by
 * EncryptionService with the organisation's data key. They are never logged
 * and never written to the audit trail.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
/** Token amounts in base units; numeric(78,0) holds any uint256. */
const amount = (name: string) => numeric(name, { precision: 78, scale: 0 });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  /** Bumped on password change; sessions issued with an older value are rejected. */
  sessionVersion: integer('session_version').notNull().default(0),
  createdAt: createdAt(),
});

/** Single-use password reset tokens. Only a SHA-256 hash of the token is stored. */
export const passwordResets = pgTable(
  'password_resets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestedIp: text('requested_ip'),
    createdAt: createdAt(),
  },
  (t) => [index('password_resets_user_idx').on(t.userId)],
);

export const organisations = pgTable('organisations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  chain: text('chain').notNull(),
  network: text('network').notNull(),
  executionMode: text('execution_mode').notNull(),
  treasuryAddress: text('treasury_address'),
  assetAddress: text('asset_address').notNull(),
  assetSymbol: text('asset_symbol').notNull(),
  assetDecimals: integer('asset_decimals').notNull(),
  approvalThreshold: integer('approval_threshold').notNull(),
  allowCreatorApproval: boolean('allow_creator_approval').notNull().default(false),
  maxBatchTotal: amount('max_batch_total'),
  /** Organisation data key wrapped with the server master key. */
  dataKeyEnc: text('data_key_enc').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    walletAddress: text('wallet_address'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('members_org_user_idx').on(t.organisationId, t.userId)],
);

/**
 * Invitations for people without a Veyra account. The emailed link carries a
 * random token; only its SHA-256 hash is stored. Accepting deletes the row.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    walletAddress: text('wallet_address'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('invitations_org_email_idx').on(t.organisationId, t.email)],
);

export const contractors = pgTable(
  'contractors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    nameEnc: text('name_enc').notNull(),
    emailEnc: text('email_enc'),
    country: text('country'),
    payoutAddressEnc: text('payout_address_enc').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('contractors_org_idx').on(t.organisationId)],
);

export const payrollBatches = pgTable(
  'payroll_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    status: text('status').notNull(),
    executionMode: text('execution_mode').notNull(),
    assetAddress: text('asset_address').notNull(),
    assetSymbol: text('asset_symbol').notNull(),
    assetDecimals: integer('asset_decimals').notNull(),
    total: amount('total').notNull().default('0'),
    itemCount: integer('item_count').notNull().default(0),
    /** Treasury snapshot taken at submission; execution always uses this. */
    treasuryAddress: text('treasury_address'),
    commitment: text('commitment'),
    chainBatchId: text('chain_batch_id').notNull(),
    chainItemsHash: text('chain_items_hash'),
    proposalStatus: text('proposal_status').notNull().default('NONE'),
    proposalTxHash: text('proposal_tx_hash'),
    proposalError: text('proposal_error'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => members.id),
    cancelReason: text('cancel_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('batches_org_idx').on(t.organisationId, t.createdAt)],
);

export const payrollItems = pgTable(
  'payroll_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => payrollBatches.id, { onDelete: 'cascade' }),
    contractorId: uuid('contractor_id')
      .notNull()
      .references(() => contractors.id),
    position: integer('position').notNull(),
    /** Snapshot of the contractor payout address (refreshed at submission). */
    recipientEnc: text('recipient_enc'),
    amountEnc: text('amount_enc').notNull(),
  },
  (t) => [
    uniqueIndex('items_batch_position_idx').on(t.batchId, t.position),
    uniqueIndex('items_batch_contractor_idx').on(t.batchId, t.contractorId),
  ],
);

export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => payrollBatches.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    status: text('status').notNull(),
    walletAddress: text('wallet_address'),
    txHash: text('tx_hash'),
    error: text('error'),
    createdAt: createdAt(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    // One live approval per member per batch; failed attempts may be retried.
    uniqueIndex('approvals_live_idx')
      .on(t.batchId, t.memberId)
      .where(sql`status <> 'FAILED'`),
  ],
);

export const executions = pgTable(
  'executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => payrollBatches.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull(),
    status: text('status').notNull(),
    txHash: text('tx_hash'),
    submittedBy: uuid('submitted_by')
      .notNull()
      .references(() => members.id),
    error: text('error'),
    verification: jsonb('verification'),
    createdAt: createdAt(),
    finalisedAt: timestamp('finalised_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('executions_attempt_idx').on(t.batchId, t.attempt),
    uniqueIndex('executions_tx_idx').on(t.txHash),
    // At most one in-flight execution per batch: prevents double payment races.
    uniqueIndex('executions_inflight_idx')
      .on(t.batchId)
      .where(sql`status = 'SUBMITTED'`),
  ],
);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => payrollBatches.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id')
    .notNull()
    .unique()
    .references(() => payrollItems.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  txHash: text('tx_hash'),
  verified: boolean('verified').notNull().default(false),
  updatedAt: updatedAt(),
});

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    data: jsonb('data').notNull().$type<Record<string, unknown>>(),
    /** ISO string used verbatim in the hash, so precision never drifts. */
    createdAt: text('created_at').notNull(),
    prevHash: text('prev_hash').notNull(),
    hash: text('hash').notNull(),
  },
  (t) => [uniqueIndex('audit_org_seq_idx').on(t.organisationId, t.seq)],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    userId: uuid('user_id').notNull(),
    key: text('key').notNull(),
    route: text('route').notNull(),
    requestHash: text('request_hash').notNull(),
    statusCode: integer('status_code'),
    response: jsonb('response'),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
