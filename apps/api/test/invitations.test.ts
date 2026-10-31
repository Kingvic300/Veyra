import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MailService } from '../src/mail/mail.service.js';
import { Client, createTestApp, expectStatus, resetDatabase, sql, type TestApp } from './helpers.js';

let t: TestApp;
let mail: MailService;
let owner: Client;
let orgId = '';

function lastInviteToken(): string {
  const match = mail.outbox.at(-1)?.text.match(/\/invite\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('No invitation link in outbox');
  return match[1]!;
}

beforeAll(async () => {
  await resetDatabase();
  t = await createTestApp();
  mail = t.app.get(MailService);
  owner = await new Client(t, 'owner@invite.dev').register('Olu Owner');
  const org = await owner.post('/organisations', {
    name: 'Invite Studio',
    chain: 'simulated',
    network: 'local',
    executionMode: 'simulated',
    treasuryAddress: 'sim:treasury',
    asset: { address: 'sim:usdc', symbol: 'USDC', decimals: 6 },
    approvalPolicy: { threshold: 1, allowCreatorApproval: false, maxBatchTotal: null },
  });
  expectStatus(org, 201);
  orgId = org.body.id;
});

afterAll(async () => {
  await t?.app.close();
});

describe('invitations', () => {
  it('adds people who already have an account straight away', async () => {
    await new Client(t, 'existing@invite.dev').register('Existing Person');
    const res = await owner.post(`/organisations/${orgId}/invitations`, { email: 'Existing@invite.dev', role: 'VIEWER' });
    expectStatus(res, 201);
    expect(res.body.status).toBe('added');
    expect(res.body.member.email).toBe('existing@invite.dev');
  });

  it('emails an invitation link to someone without an account and stores only a hash', async () => {
    const res = await owner.post(`/organisations/${orgId}/invitations`, { email: 'new@invite.dev', role: 'APPROVER' });
    expectStatus(res, 201);
    expect(res.body.status).toBe('invited');
    expect(mail.outbox.at(-1)!.to).toBe('new@invite.dev');
    expect(mail.outbox.at(-1)!.subject).toBe('Olu Owner invited you to Invite Studio on Veyra');
    const rows = await sql('select token_hash from invitations');
    expect(rows.rows.map((r) => r.token_hash)).not.toContain(lastInviteToken());
    expect((await owner.get(`/organisations/${orgId}/invitations`)).body).toHaveLength(1);
  });

  it('shows a public preview for a valid link and rejects a made-up one', async () => {
    const ok = await t.http().get(`/v1/invitations/${lastInviteToken()}`);
    expectStatus(ok, 200);
    expect(ok.body).toEqual({ email: 'new@invite.dev', organisationName: 'Invite Studio', invitedByName: 'Olu Owner', role: 'APPROVER' });
    expect((await t.http().get(`/v1/invitations/${'x'.repeat(43)}`)).status).toBe(400);
  });

  it('refuses to sign up with the link under a different email', async () => {
    const res = await t
      .http()
      .post('/v1/auth/register')
      .send({ email: 'attacker@evil.dev', name: 'Mallory', password: 'abcd1234', inviteToken: lastInviteToken() });
    expect(res.status).toBe(403);
    expect((await sql(`select 1 from users where email = 'attacker@evil.dev'`)).rowCount).toBe(0);
  });

  it('joins the organisation with the invited role on sign-up and burns the link', async () => {
    const token = lastInviteToken();
    const res = await t.http().post('/v1/auth/register').send({ email: 'new@invite.dev', name: 'Nia New', password: 'abcd1234', inviteToken: token });
    expectStatus(res, 201);
    expect(res.body.joinedOrganisationId).toBe(orgId);
    const members = (await owner.get(`/organisations/${orgId}/members`)).body as { email: string; role: string }[];
    expect(members.find((m) => m.email === 'new@invite.dev')?.role).toBe('APPROVER');
    expect((await owner.get(`/organisations/${orgId}/invitations`)).body).toHaveLength(0);
    expect((await t.http().get(`/v1/invitations/${token}`)).status).toBe(400);
  });

  it('lets a signed-in person with the invited email accept, and lets managers revoke', async () => {
    const late = await new Client(t, 'late@invite.dev').register('Late Joiner');
    // Invite first, as if the account did not exist yet.
    await sql(`delete from members where user_id = $1`, [late.userId]);
    await owner.post(`/organisations/${orgId}/invitations`, { email: 'other@invite.dev', role: 'VIEWER' });
    const invites = (await owner.get(`/organisations/${orgId}/invitations`)).body as { id: string }[];
    expectStatus(await owner.delete(`/organisations/${orgId}/invitations/${invites[0]!.id}`), 204);
    expect((await t.http().get(`/v1/invitations/${lastInviteToken()}`)).status).toBe(400);

    await sql(`delete from users where email = 'late2@invite.dev'`);
    await owner.post(`/organisations/${orgId}/invitations`, { email: 'late2@invite.dev', role: 'VIEWER' });
    const token = lastInviteToken();
    const late2 = await new Client(t, 'late2@invite.dev').register('Late Two');
    expect((await late.post('/invitations/accept', { token })).status).toBe(403);
    const accepted = await late2.post('/invitations/accept', { token });
    expectStatus(accepted, 200);
    expect(accepted.body.organisationId).toBe(orgId);
  });

  it('only lets managers invite', async () => {
    const viewer = await new Client(t, 'viewer2@invite.dev').register('View Only');
    await owner.post(`/organisations/${orgId}/invitations`, { email: viewer.email, role: 'VIEWER' });
    expect((await viewer.post(`/organisations/${orgId}/invitations`, { email: 'x@invite.dev', role: 'OWNER' })).status).toBe(403);
  });
});

describe('profile', () => {
  it('updates the name and signs out everywhere', async () => {
    const res = await owner.patch('/auth/me', { name: '  Olu Renamed ' });
    expectStatus(res, 200);
    expect(res.body.name).toBe('Olu Renamed');
    expectStatus(await owner.post('/auth/sessions/revoke'), 204);
    expect((await owner.get('/auth/me')).status).toBe(401);
  });
});
