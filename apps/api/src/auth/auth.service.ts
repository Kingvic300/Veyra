import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { LoginInput, RegisterInput, User } from '@veyra/core';
import { DB, schema, type Db } from '../db/database.js';
import { conflict, notFound, unauthorised } from '../common/errors.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password.js';

export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function toUser(row: typeof schema.users.$inferSelect): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.createdAt.toISOString() };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<{ user: User; token: string }> {
    const existing = await this.db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
    if (existing) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
    const [row] = await this.db
      .insert(schema.users)
      .values({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) })
      .returning();
    return { user: toUser(row!), token: await this.issue(row!.id, row!.email) };
  }

  async login(input: LoginInput): Promise<{ user: User; token: string }> {
    const row = await this.db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
    // Always run the KDF so response time does not reveal whether the email exists.
    const ok = await verifyPassword(input.password, row?.passwordHash ?? DUMMY_HASH);
    if (!row || !ok) throw unauthorised('Invalid email or password');
    return { user: toUser(row), token: await this.issue(row.id, row.email) };
  }

  async me(userId: string): Promise<User> {
    const row = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!row) throw notFound('User');
    return toUser(row);
  }

  private issue(userId: string, email: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId, email }, { expiresIn: SESSION_TTL_SECONDS });
  }
}
