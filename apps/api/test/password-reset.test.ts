import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MailService } from '../src/mail/mail.service.js';
import { Client, createTestApp, expectStatus, resetDatabase, sql, type TestApp } from './helpers.js';

let t: TestApp;
let mail: MailService;
let user: Client;

const OLD_PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'a much better passphrase';

function lastToken(): string {
  const message = mail.outbox.at(-1);
  const match = message?.text.match(/reset-password\?token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('No reset link in outbox');
  return match[1]!;
}

beforeAll(async () => {
  await resetDatabase();
  t = await createTestApp();
  mail = t.app.get(MailService);
  user = await new Client(t, 'reset@acme.dev').register('Ada Reset');
});

afterAll(async () => {
  await t?.app.close();
});

describe('forgot password', () => {
  it('answers the same way for unknown and known emails, and only mails known ones', async () => {
    const before = mail.outbox.length;
    const unknown = await t.http().post('/v1/auth/password/forgot').send({ email: 'nobody@acme.dev' });
    expect(unknown.status).toBe(202);
    expect(mail.outbox.length).toBe(before);

    const known = await t.http().post('/v1/auth/password/forgot').send({ email: 'Reset@Acme.dev' });
    expect(known.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(mail.outbox.length).toBe(before + 1);
    expect(mail.outbox.at(-1)!.to).toBe('reset@acme.dev');
    expect(mail.outbox.at(-1)!.html).toContain(`${t.config.appUrl}/reset-password?token=`);

    // Only a hash of the token is stored.
    const rows = await sql('select token_hash from password_resets');
    expect(rows.rows.map((r) => r.token_hash)).not.toContain(lastToken());
  });
});

describe('reset password', () => {
  it('rejects unknown tokens and weak passwords', async () => {
    const bogus = await t.http().post('/v1/auth/password/reset').send({ token: 'x'.repeat(43), password: NEW_PASSWORD });
    expect(bogus.status).toBe(400);
    expect(bogus.body.error.code).toBe('INVALID_RESET_TOKEN');

    const weak = await t.http().post('/v1/auth/password/reset').send({ token: lastToken(), password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('sets the new password, signs out every session and burns the token', async () => {
    const token = lastToken();
    expect((await user.get('/auth/me')).status).toBe(200);

    expectStatus(await t.http().post('/v1/auth/password/reset').send({ token, password: NEW_PASSWORD }), 204);

    expect((await user.get('/auth/me')).status).toBe(401);
    expect((await t.http().post('/v1/auth/login').send({ email: user.email, password: OLD_PASSWORD })).status).toBe(401);
    const login = await t.http().post('/v1/auth/login').send({ email: user.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    user.token = login.body.token;
    expect((await user.get('/auth/me')).status).toBe(200);

    const reused = await t.http().post('/v1/auth/password/reset').send({ token, password: 'yet another passphrase' });
    expect(reused.status).toBe(400);
  });

  it('rejects expired tokens', async () => {
    expectStatus(await t.http().post('/v1/auth/password/forgot').send({ email: user.email }), 202);
    await sql(`update password_resets set expires_at = now() - interval '1 minute' where used_at is null`);
    const res = await t.http().post('/v1/auth/password/reset').send({ token: lastToken(), password: 'yet another passphrase' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('stops sending emails once an account hits the hourly cap', async () => {
    await sql(
      `insert into password_resets (user_id, token_hash, expires_at)
       select $1, md5(random()::text), now() + interval '30 minutes' from generate_series(1, 5)`,
      [user.userId],
    );
    const before = mail.outbox.length;
    expectStatus(await t.http().post('/v1/auth/password/forgot').send({ email: user.email }), 202);
    expect(mail.outbox.length).toBe(before);
  });
});

describe('change password', () => {
  it('requires the current password', async () => {
    const res = await user.post('/auth/password/change', { currentPassword: 'wrong password!!', newPassword: 'third passphrase here' });
    expect(res.status).toBe(401);
  });

  it('keeps the caller signed in with a new token and signs out other sessions', async () => {
    const other = await t.http().post('/v1/auth/login').send({ email: user.email, password: NEW_PASSWORD });
    const otherToken: string = other.body.token;

    const res = await user.post('/auth/password/change', { currentPassword: NEW_PASSWORD, newPassword: 'third passphrase here' });
    expectStatus(res, 200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/veyra_session=.+HttpOnly/i);

    expect((await user.get('/auth/me')).status).toBe(401);
    user.token = res.body.token;
    expect((await user.get('/auth/me')).status).toBe(200);
    expect((await t.http().get('/v1/auth/me').set('Authorization', `Bearer ${otherToken}`)).status).toBe(401);

    // Outstanding reset links die with the old password.
    const open = await sql('select count(*)::int as n from password_resets where used_at is null');
    expect(open.rows[0].n).toBe(0);
  });
});
