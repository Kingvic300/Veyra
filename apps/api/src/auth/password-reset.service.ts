import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { ChangePasswordInput, ResetPasswordInput } from '@veyra/core';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DB, schema, type Db } from '../db/database.js';
import { badRequest, unauthorised } from '../common/errors.js';
import { MailService, escapeHtml } from '../mail/mail.service.js';
import { hashPassword, verifyPassword } from './password.js';

export const RESET_TTL_MINUTES = 30;
/** At most this many reset emails per account per hour. */
const MAX_REQUESTS_PER_HOUR = 5;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger('PasswordReset');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly mail: MailService,
  ) {}

  /**
   * Start a reset. Always resolves the same way whether or not the email
   * exists, so the endpoint cannot be used to discover accounts.
   */
  async request(email: string, ip: string | null): Promise<void> {
    const user = await this.db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!user) return;

    const recent = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.passwordResets)
      .where(and(eq(schema.passwordResets.userId, user.id), gt(schema.passwordResets.createdAt, new Date(Date.now() - 3_600_000))));
    if ((recent[0]?.n ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      this.logger.warn(`Reset rate limit reached for user ${user.id}`);
      return;
    }

    const token = randomBytes(32).toString('base64url');
    await this.db.insert(schema.passwordResets).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      requestedIp: ip,
    });

    const link = `${this.config.appUrl}/reset-password?token=${token}`;
    const name = user.name.split(' ')[0] ?? user.name;
    // Not awaited: a slow or failing mail provider must not make known emails
    // answer slower or differently from unknown ones.
    void this.mail
      .send({
        to: user.email,
        subject: 'Reset your Veyra password',
        text: [
          `Hi ${name},`,
          '',
          `Someone asked to reset the password for your Veyra account. Use this link within ${RESET_TTL_MINUTES} minutes:`,
          link,
          '',
          'If you did not ask for this, ignore this email. Your password will not change.',
        ].join('\n'),
        html: `<p>Hi ${escapeHtml(name)},</p>
<p>Someone asked to reset the password for your Veyra account. Use this link within ${RESET_TTL_MINUTES} minutes:</p>
<p><a href="${escapeHtml(link)}">Choose a new password</a></p>
<p>If you did not ask for this, ignore this email. Your password will not change.</p>`,
      })
      .catch((err: unknown) => this.logger.error(`Reset email to user ${user.id} failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  /** Complete a reset with a token from the email. Signs out every session. */
  async reset(input: ResetPasswordInput): Promise<void> {
    const invalid = () => badRequest('INVALID_RESET_TOKEN', 'This reset link is invalid or has expired. Request a new one.');
    const passwordHash = await hashPassword(input.password);
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.passwordResets)
        .where(and(eq(schema.passwordResets.tokenHash, hashToken(input.token)), isNull(schema.passwordResets.usedAt)))
        .for('update');
      if (!row || row.expiresAt.getTime() < Date.now()) throw invalid();

      const now = new Date();
      await tx
        .update(schema.users)
        .set({ passwordHash, sessionVersion: sql`${schema.users.sessionVersion} + 1` })
        .where(eq(schema.users.id, row.userId));
      // Burn this token and every other outstanding token for the account.
      await tx
        .update(schema.passwordResets)
        .set({ usedAt: now })
        .where(and(eq(schema.passwordResets.userId, row.userId), isNull(schema.passwordResets.usedAt)));
    });
  }

  /** Change password while signed in. Signs out other sessions. */
  async change(userId: string, input: ChangePasswordInput): Promise<number> {
    const user = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw unauthorised('Your current password is not correct');
    }
    if (input.currentPassword === input.newPassword) throw badRequest('SAME_PASSWORD', 'Choose a password you have not used here');
    const [row] = await this.db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(input.newPassword), sessionVersion: sql`${schema.users.sessionVersion} + 1` })
      .where(eq(schema.users.id, userId))
      .returning({ sessionVersion: schema.users.sessionVersion });
    await this.db
      .update(schema.passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResets.userId, userId), isNull(schema.passwordResets.usedAt)));
    return row!.sessionVersion;
  }
}
