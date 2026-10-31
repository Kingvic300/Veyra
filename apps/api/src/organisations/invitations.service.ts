import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditActions, canAssignRole, type AddMemberInput, type Invitation, type InvitationPreview, type InviteResult, type Role } from '@veyra/core';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DB, schema, type Db } from '../db/database.js';
import { AccessService, isUuid } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ChainService } from '../chain/chain.service.js';
import { badRequest, forbidden, notFound } from '../common/errors.js';
import { MailService, escapeHtml } from '../mail/mail.service.js';
import { hashToken } from '../auth/password-reset.service.js';
import { OrganisationsService } from './organisations.service.js';

export const INVITATION_TTL_DAYS = 7;

const ROLE_WORDS: Record<Role, string> = {
  OWNER: 'an owner',
  ADMIN: 'an admin',
  APPROVER: 'an approver',
  VIEWER: 'a viewer',
};

type InvitationRow = typeof schema.invitations.$inferSelect;

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    organisationId: row.organisationId,
    email: row.email,
    role: row.role as Role,
    walletAddress: row.walletAddress,
    invitedBy: row.invitedBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

const invalidInvitation = () => badRequest('INVALID_INVITATION', 'This invitation link is invalid or has expired. Ask for a new one.');

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger('Invitations');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly chain: ChainService,
    private readonly mail: MailService,
    private readonly orgs: OrganisationsService,
  ) {}

  /**
   * Add someone to the organisation. People who already have an account join
   * straight away; everyone else gets an emailed invitation link.
   */
  async invite(userId: string, orgId: string, input: AddMemberInput): Promise<InviteResult> {
    const { org, member: actor } = await this.access.require(userId, orgId, 'members:manage');
    if (!canAssignRole(actor.role, input.role)) throw forbidden(`Your role cannot assign ${input.role}`);

    const existing = await this.db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
    if (existing) return { status: 'added', member: await this.orgs.addMember(userId, orgId, input) };

    const walletAddress = input.walletAddress ? this.chain.adapter(org).normaliseAddress(input.walletAddress) : null;
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000);
    const row = await this.db.transaction(async (tx) => {
      // Inviting the same email again replaces the old link.
      const [saved] = await tx
        .insert(schema.invitations)
        .values({ organisationId: orgId, email: input.email, role: input.role, walletAddress, tokenHash: hashToken(token), invitedBy: userId, expiresAt })
        .onConflictDoUpdate({
          target: [schema.invitations.organisationId, schema.invitations.email],
          set: { role: input.role, walletAddress, tokenHash: hashToken(token), invitedBy: userId, expiresAt, createdAt: new Date() },
        })
        .returning();
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.InvitationSent,
        entityType: 'invitation',
        entityId: saved!.id,
        data: { role: input.role },
      });
      return saved!;
    });

    const inviter = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    await this.sendEmail(input.email, token, org.name, inviter?.name ?? 'A teammate', input.role);
    return { status: 'invited', invitation: toInvitation(row) };
  }

  async list(userId: string, orgId: string): Promise<Invitation[]> {
    await this.access.require(userId, orgId, 'org:read');
    const rows = await this.db.query.invitations.findMany({
      where: eq(schema.invitations.organisationId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return rows.map(toInvitation);
  }

  async revoke(userId: string, orgId: string, invitationId: string): Promise<void> {
    await this.access.require(userId, orgId, 'members:manage');
    if (!isUuid(invitationId)) throw notFound('Invitation');
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .delete(schema.invitations)
        .where(and(eq(schema.invitations.id, invitationId), eq(schema.invitations.organisationId, orgId)))
        .returning();
      if (!row) throw notFound('Invitation');
      await this.audit.append(tx, {
        organisationId: orgId,
        actorId: userId,
        action: AuditActions.InvitationRevoked,
        entityType: 'invitation',
        entityId: row.id,
        data: { role: row.role },
      });
    });
  }

  /** Public: what an invitation link is for. Reveals nothing without the secret token. */
  async preview(token: string): Promise<InvitationPreview> {
    const row = await this.findValid(token);
    const [org, inviter] = await Promise.all([
      this.db.query.organisations.findFirst({ where: eq(schema.organisations.id, row.organisationId) }),
      this.db.query.users.findFirst({ where: eq(schema.users.id, row.invitedBy) }),
    ]);
    return { email: row.email, organisationName: org?.name ?? 'an organisation', invitedByName: inviter?.name ?? 'A teammate', role: row.role as Role };
  }

  /**
   * Join the organisation behind `token`. The signed-in account must use the
   * invited email address. Returns the organisation id.
   */
  async accept(user: { id: string; email: string }, token: string): Promise<string> {
    const row = await this.findValid(token);
    if (row.email !== user.email.toLowerCase()) {
      throw forbidden('This invitation was sent to a different email address. Sign in with that address to accept it.');
    }
    await this.db.transaction(async (tx) => {
      const already = await tx.query.members.findFirst({
        where: and(eq(schema.members.organisationId, row.organisationId), eq(schema.members.userId, user.id)),
      });
      if (!already) {
        const [member] = await tx
          .insert(schema.members)
          .values({ organisationId: row.organisationId, userId: user.id, role: row.role, walletAddress: row.walletAddress })
          .returning();
        await this.audit.append(tx, {
          organisationId: row.organisationId,
          actorId: user.id,
          action: AuditActions.MemberAdded,
          entityType: 'member',
          entityId: member!.id,
          data: { role: row.role, walletAddress: row.walletAddress, via: 'invitation' },
        });
      }
      await tx.delete(schema.invitations).where(eq(schema.invitations.id, row.id));
    });
    return row.organisationId;
  }

  private async findValid(token: string): Promise<InvitationRow> {
    const row = await this.db.query.invitations.findFirst({ where: eq(schema.invitations.tokenHash, hashToken(token)) });
    if (!row || row.expiresAt.getTime() < Date.now()) throw invalidInvitation();
    return row;
  }

  private async sendEmail(to: string, token: string, orgName: string, inviterName: string, role: Role): Promise<void> {
    const link = `${this.config.appUrl}/invite/${token}`;
    const subject = `${inviterName} invited you to ${orgName} on Veyra`;
    const lead = `${inviterName} invited you to join ${orgName} on Veyra as ${ROLE_WORDS[role]}. Veyra is how ${orgName} pays its team.`;
    try {
      await this.mail.send({
        to,
        subject,
        text: [lead, '', `Accept within ${INVITATION_TTL_DAYS} days:`, link, '', 'If you were not expecting this, ignore this email.'].join('\n'),
        html: `<p>${escapeHtml(lead)}</p>
<p><a href="${escapeHtml(link)}">Accept the invitation</a></p>
<p>The link works for ${INVITATION_TTL_DAYS} days. If you were not expecting this, ignore this email.</p>`,
      });
    } catch (err) {
      this.logger.error(`Invitation email failed: ${err instanceof Error ? err.message : String(err)}`);
      throw badRequest('INVITE_EMAIL_FAILED', 'The invitation was saved but the email could not be sent. Try again in a minute.');
    }
  }
}
