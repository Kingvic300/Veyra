import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createTestApp, expectStatus, resetDatabase, sql, type TestApp } from './helpers.js';

let t: TestApp;
let owner: Client;
let approver1: Client;
let approver2: Client;
let viewer: Client;
let outsider: Client;
let orgId = '';
let batchId = '';
const contractorIds: string[] = [];

beforeAll(async () => {
  await resetDatabase();
  t = await createTestApp();
  owner = await new Client(t, 'owner@acme.dev').register('Ada Owner');
  approver1 = await new Client(t, 'ap1@acme.dev').register('Bayo Approver');
  approver2 = await new Client(t, 'ap2@acme.dev').register('Chioma Approver');
  viewer = await new Client(t, 'viewer@acme.dev').register('Dee Viewer');
  outsider = await new Client(t, 'outsider@evil.dev').register('Eve');
});

afterAll(async () => {
  await t?.app.close();
});

describe('auth', () => {
  it('rejects duplicate registration and bad passwords', async () => {
    const dup = await t.http().post('/v1/auth/register').send({ email: 'owner@acme.dev', name: 'x', password: 'correct horse battery' });
    expect(dup.status).toBe(409);
    const bad = await t.http().post('/v1/auth/login').send({ email: 'owner@acme.dev', password: 'wrong password!!' });
    expect(bad.status).toBe(401);
    const unknown = await t.http().post('/v1/auth/login').send({ email: 'nobody@acme.dev', password: 'wrong password!!' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message);
  });

  it('sets an httpOnly session cookie and requires the CSRF header for cookie writes', async () => {
    const res = await t.http().post('/v1/auth/login').send({ email: 'owner@acme.dev', password: 'correct horse battery' });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/veyra_session=.+HttpOnly/i);
    const me = await t.http().get('/v1/auth/me').set('Cookie', cookie.split(';')[0]!);
    expect(me.body.email).toBe('owner@acme.dev');
    const noCsrf = await t.http().post('/v1/organisations').set('Cookie', cookie.split(';')[0]!).send({});
    expect(noCsrf.status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await t.http().get('/v1/organisations')).status).toBe(401);
    expect((await t.http().get('/v1/health')).status).toBe(200);
  });
});

describe('organisation setup', () => {
  it('lists the networks this server supports', async () => {
    const res = await owner.get('/networks');
    expect(res.body).toContainEqual({ chain: 'simulated', network: 'local', executionModes: ['simulated'] });
  });

  it('creates an organisation and makes the creator owner', async () => {
    const res = await owner.post('/organisations', {
      name: 'Acme Studio',
      chain: 'simulated',
      network: 'local',
      executionMode: 'simulated',
      treasuryAddress: 'sim:acme-treasury',
      asset: { address: 'sim:usdc', symbol: 'USDC', decimals: 6 },
      approvalPolicy: { threshold: 2, allowCreatorApproval: false, maxBatchTotal: null },
    });
    expectStatus(res, 201);
    orgId = res.body.id;
    expect(res.body.approvalPolicy.threshold).toBe(2);
    const me = await owner.get(`/organisations/${orgId}`);
    expect(me.body.role).toBe('OWNER');
  });

  it('adds members with roles', async () => {
    for (const [c, role] of [
      [approver1, 'APPROVER'],
      [approver2, 'APPROVER'],
      [viewer, 'VIEWER'],
    ] as const) {
      expectStatus(await owner.post(`/organisations/${orgId}/members`, { email: c.email, role }), 201);
    }
    const members = await owner.get(`/organisations/${orgId}/members`);
    expect(members.body).toHaveLength(4);
  });

  it('hides the organisation from non-members', async () => {
    expect((await outsider.get(`/organisations/${orgId}`)).status).toBe(404);
    expect((await outsider.get(`/organisations/${orgId}/batches`)).status).toBe(404);
  });

  it('does not let admins of nothing escalate roles', async () => {
    const res = await approver1.post(`/organisations/${orgId}/members`, { email: outsider.email, role: 'OWNER' });
    expect(res.status).toBe(403);
  });

  it('keeps at least one owner', async () => {
    const members = await owner.get(`/organisations/${orgId}/members`);
    const self = members.body.find((m: { email: string }) => m.email === owner.email);
    const res = await owner.patch(`/organisations/${orgId}/members/${self.id}`, { role: 'ADMIN' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });

  it('reports the simulated treasury', async () => {
    const res = await viewer.get(`/organisations/${orgId}/treasury`);
    expect(res.body).toMatchObject({ balance: '1000000000000', committed: '0' });
    expect(res.body.privacy.shieldedTransfers).toBe(false);
  });
});

describe('contractors', () => {
  it('creates contractors and encrypts personal data at rest', async () => {
    for (const [name, addr, country] of [
      ['Ngozi Okafor', 'sim:ngozi', 'NG'],
      ['Kwame Mensah', 'sim:kwame', 'GH'],
      ['Amara Diallo', 'sim:amara', 'SN'],
    ]) {
      const res = await owner.post(`/organisations/${orgId}/contractors`, { name, email: `${addr!.slice(4)}@mail.dev`, country, payoutAddress: addr });
      expectStatus(res, 201);
      contractorIds.push(res.body.id);
    }
    const raw = await sql('select name_enc, email_enc, payout_address_enc from contractors');
    const dump = JSON.stringify(raw.rows);
    expect(dump).not.toContain('Ngozi');
    expect(dump).not.toContain('sim:ngozi');
    expect(raw.rows[0].name_enc).toMatch(/^v1\./);
  });

  it('rejects invalid payout addresses', async () => {
    const res = await owner.post(`/organisations/${orgId}/contractors`, { name: 'Bad', payoutAddress: 'not an address' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CHAIN_INVALID_ADDRESS');
  });

  it('hides contractor records from viewers', async () => {
    expect((await viewer.get(`/organisations/${orgId}/contractors`)).status).toBe(403);
    expect((await approver1.get(`/organisations/${orgId}/contractors`)).body).toHaveLength(3);
  });
});

describe('payroll batch lifecycle', () => {
  it('creates a draft batch', async () => {
    const res = await owner.post(`/organisations/${orgId}/batches`, {
      title: 'October 2026 contractors',
      items: [
        { contractorId: contractorIds[0], amount: '1500' },
        { contractorId: contractorIds[1], amount: '2250.50' },
        { contractorId: contractorIds[2], amount: '980.25' },
      ],
    });
    expectStatus(res, 201);
    batchId = res.body.id;
    expect(res.body).toMatchObject({ status: 'DRAFT', total: '4730750000', itemCount: 3 });
  });

  it('rejects duplicate contractors and bad amounts', async () => {
    const dup = await owner.post(`/organisations/${orgId}/batches`, {
      title: 'dup',
      items: [
        { contractorId: contractorIds[0], amount: '1' },
        { contractorId: contractorIds[0], amount: '2' },
      ],
    });
    expect(dup.body.error.code).toBe('DUPLICATE_CONTRACTOR');
    const precision = await owner.post(`/organisations/${orgId}/batches`, {
      title: 'p',
      items: [{ contractorId: contractorIds[0], amount: '1.0000001' }],
    });
    expect(precision.body.error.code).toBe('INVALID_AMOUNT');
  });

  it('shows items to approvers but only totals to viewers', async () => {
    const asApprover = await approver1.get(`/organisations/${orgId}/batches/${batchId}`);
    expect(asApprover.body.items).toHaveLength(3);
    expect(asApprover.body.items[0].contractorName).toBe('Ngozi Okafor');
    const asViewer = await viewer.get(`/organisations/${orgId}/batches/${batchId}`);
    expect(asViewer.body.items).toBeUndefined();
    expect(asViewer.body.total).toBe('4730750000');
  });

  it('edits a draft', async () => {
    const res = await owner.patch(`/organisations/${orgId}/batches/${batchId}`, {
      items: [
        { contractorId: contractorIds[0], amount: '1500' },
        { contractorId: contractorIds[1], amount: '2250.50' },
        { contractorId: contractorIds[2], amount: '1000' },
      ],
    });
    expect(res.body.total).toBe('4750500000');
  });

  it('validates before submission', async () => {
    const res = await owner.post(`/organisations/${orgId}/batches/${batchId}/validate`);
    expect(res.body.ok).toBe(true);
    expect(res.body.capabilities.onChainApprovals).toBe(false);
  });

  it('cannot approve or execute a draft', async () => {
    expect((await approver1.post(`/organisations/${orgId}/batches/${batchId}/approvals`)).status).toBe(409);
    expect((await owner.post(`/organisations/${orgId}/batches/${batchId}/execute`)).status).toBe(409);
  });

  it('submits with a commitment and freezes edits', async () => {
    const res = await owner.post(`/organisations/${orgId}/batches/${batchId}/submit`);
    expectStatus(res, 200);
    expect(res.body.status).toBe('PENDING_APPROVAL');
    expect(res.body.commitment).toMatch(/^[0-9a-f]{64}$/);
    const edit = await owner.patch(`/organisations/${orgId}/batches/${batchId}`, { title: 'changed' });
    expect(edit.body.error.code).toBe('NOT_EDITABLE');
  });

  it('enforces separation of duties and the approval threshold', async () => {
    const self = await owner.post(`/organisations/${orgId}/batches/${batchId}/approvals`);
    expect(self.body.error.code).toBe('CREATOR_CANNOT_APPROVE');
    const byViewer = await viewer.post(`/organisations/${orgId}/batches/${batchId}/approvals`);
    expect(byViewer.status).toBe(403);

    const first = await approver1.post(`/organisations/${orgId}/batches/${batchId}/approvals`);
    expect(first.body.status).toBe('PENDING_APPROVAL');
    expect(first.body.approvalSummary).toMatchObject({ confirmed: 1, required: 2 });
    const again = await approver1.post(`/organisations/${orgId}/batches/${batchId}/approvals`);
    expect(again.body.error.code).toBe('ALREADY_APPROVED');

    expect((await owner.post(`/organisations/${orgId}/batches/${batchId}/execute`)).body.error.code).toBe('INVALID_STATE');

    const second = await approver2.post(`/organisations/${orgId}/batches/${batchId}/approvals`);
    expect(second.body.status).toBe('APPROVED');
  });

  it('counts approved batches as committed treasury funds', async () => {
    const res = await owner.get(`/organisations/${orgId}/treasury`);
    expect(res.body.committed).toBe('4750500000');
    expect(res.body.available).toBe(String(1_000_000_000_000n - 4_750_500_000n));
  });

  it('approvers cannot execute', async () => {
    expect((await approver1.post(`/organisations/${orgId}/batches/${batchId}/execute`)).status).toBe(403);
  });

  it('executes, settles and verifies every payment', async () => {
    const res = await owner.post(`/organisations/${orgId}/batches/${batchId}/execute`);
    expectStatus(res, 200);
    expect(res.body.status).toBe('EXECUTING');
    await t.monitor.idle();
    const done = await owner.get(`/organisations/${orgId}/batches/${batchId}`);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.executions).toHaveLength(1);
    expect(done.body.executions[0].verification).toMatchObject({ verified: true, method: 'simulated' });
    expect(done.body.payments.every((p: { status: string; verified: boolean }) => p.status === 'CONFIRMED' && p.verified)).toBe(true);
    const treasury = await owner.get(`/organisations/${orgId}/treasury`);
    expect(treasury.body).toMatchObject({ balance: String(1_000_000_000_000n - 4_750_500_000n), committed: '0' });
  });

  it('never executes a completed batch again', async () => {
    const res = await owner.post(`/organisations/${orgId}/batches/${batchId}/execute`);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('exports a receipt and a safe CSV', async () => {
    const receipt = await owner.get(`/organisations/${orgId}/batches/${batchId}/receipt`);
    expect(receipt.body.batch.status).toBe('COMPLETED');
    expect(receipt.body.items).toHaveLength(3);
    expect(receipt.body.approvals).toHaveLength(2);
    expect(receipt.body.auditTrail.map((e: { action: string }) => e.action)).toContain('batch.completed');
    const csv = await owner.get(`/organisations/${orgId}/batches/${batchId}/receipt.csv`);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\n')[1]).toContain('"Ngozi Okafor"');
    expect((await viewer.get(`/organisations/${orgId}/batches/${batchId}/receipt`)).status).toBe(403);
  });

  it('cancels a draft', async () => {
    const draft = await owner.post(`/organisations/${orgId}/batches`, {
      title: 'Mistake',
      items: [{ contractorId: contractorIds[0], amount: '10' }],
    });
    const res = await owner.post(`/organisations/${orgId}/batches/${draft.body.id}/cancel`, { reason: 'duplicate' });
    expect(res.body.batch.status).toBe('CANCELLED');
    expect(res.body.onchainCancel).toBeNull();
  });

  it('blocks submission over the policy limit', async () => {
    await owner.patch(`/organisations/${orgId}`, {
      approvalPolicy: { threshold: 2, allowCreatorApproval: false, maxBatchTotal: '1000000' },
    });
    const draft = await owner.post(`/organisations/${orgId}/batches`, {
      title: 'Too big',
      items: [{ contractorId: contractorIds[0], amount: '5' }],
    });
    const res = await owner.post(`/organisations/${orgId}/batches/${draft.body.id}/submit`);
    expect(res.body.error.code).toBe('BATCH_INVALID');
    expect(res.body.error.details.map((d: { code: string }) => d.code)).toContain('EXCEEDS_POLICY_LIMIT');
  });
});

describe('audit trail', () => {
  it('verifies the hash chain', async () => {
    const res = await viewer.get(`/organisations/${orgId}/audit/verify`);
    expect(res.body.valid).toBe(true);
    expect(res.body.checked).toBeGreaterThan(10);
  });

  it('keeps personal data out of the audit log', async () => {
    const res = await owner.get(`/organisations/${orgId}/audit?limit=200`);
    expect(JSON.stringify(res.body)).not.toContain('Ngozi');
  });

  it('detects tampering', async () => {
    await sql(`update audit_events set data = '{"total":"1"}' where organisation_id = $1 and action = 'batch.submitted'`, [orgId]);
    const res = await owner.get(`/organisations/${orgId}/audit/verify`);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/altered/);
  });
});

describe('stats', () => {
  it('aggregates paid batches, months and contractors', async () => {
    const res = await owner.get(`/organisations/${orgId}/stats`);
    expectStatus(res, 200);
    expect(res.body).toMatchObject({ paidAllTime: '4750500000', completedBatches: 1, completedPayments: 3, activeContractors: 3 });
    expect(res.body.monthly).toHaveLength(6);
    expect(res.body.monthly.at(-1).total).toBe('4750500000');
    expect(res.body.contractors[0]).toMatchObject({ name: 'Kwame Mensah', total: '2250500000', payments: 1 });
    expect(res.body.byCountry.map((c: { country: string }) => c.country)).toEqual(['GH', 'NG', 'SN']);
    expect(res.body.medianApprovalHours).not.toBeNull();
  });

  it('withholds per-contractor figures from viewers', async () => {
    const res = await viewer.get(`/organisations/${orgId}/stats`);
    expect(res.body.paidAllTime).toBe('4750500000');
    expect(res.body.contractors).toBeNull();
    expect(res.body.byCountry).toBeNull();
  });
});
