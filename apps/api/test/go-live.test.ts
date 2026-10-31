import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createTestApp, expectStatus, resetDatabase, type TestApp } from './helpers.js';

let t: TestApp;
let owner: Client;
let approver: Client;
let practiceId = '';
const PAYER = `0x${'beef'.padStart(64, '0')}`;
const TOKEN = `0x${'70c3'.padStart(64, '0')}`;
const live = {
  name: 'Live Studio',
  chain: 'starknet',
  network: 'devnet',
  executionMode: 'wallet',
  treasuryAddress: PAYER,
  asset: { address: TOKEN, symbol: 'USDC', decimals: 6 },
  approvalPolicy: { threshold: 1, allowCreatorApproval: false, maxBatchTotal: null },
};

beforeAll(async () => {
  await resetDatabase();
  t = await createTestApp();
  owner = await new Client(t, 'owner@golive.dev').register('Owner');
  approver = await new Client(t, 'approver@golive.dev').register('Approver');
  const org = await owner.post('/organisations', {
    name: 'Practice Studio',
    chain: 'simulated',
    network: 'local',
    executionMode: 'simulated',
    treasuryAddress: 'sim:treasury',
    asset: { address: 'sim:usdc', symbol: 'USDC', decimals: 6 },
    approvalPolicy: { threshold: 1, allowCreatorApproval: true, maxBatchTotal: null },
  });
  practiceId = org.body.id;
  await owner.post(`/organisations/${practiceId}/members`, { email: approver.email, role: 'APPROVER' });
  await owner.post(`/organisations/${practiceId}/contractors`, { name: 'Sim Person', country: 'NG', payoutAddress: 'sim:ngozi' });
  await owner.post(`/organisations/${practiceId}/contractors`, { name: 'Real Person', payoutAddress: '0x0abc' });
});

afterAll(async () => {
  await t?.app.close();
});

describe('going live from practice', () => {
  it('creates a live company with the same team and the people who have real wallets', async () => {
    const res = await owner.post(`/organisations/${practiceId}/go-live`, live);
    expectStatus(res, 201);
    expect(res.body.organisation).toMatchObject({ name: 'Live Studio', chain: 'starknet', executionMode: 'wallet' });
    expect(res.body).toMatchObject({ copiedMembers: 1, copiedPeople: 1, peopleNeedingWallets: [{ name: 'Sim Person', email: null, country: 'NG' }] });

    const liveId = res.body.organisation.id;
    const members = (await owner.get(`/organisations/${liveId}/members`)).body as { email: string; role: string }[];
    expect(members.map((m) => [m.email, m.role]).sort()).toEqual([
      ['approver@golive.dev', 'APPROVER'],
      ['owner@golive.dev', 'OWNER'],
    ]);
    const people = (await owner.get(`/organisations/${liveId}/contractors`)).body as { name: string }[];
    expect(people.map((p) => p.name)).toEqual(['Real Person']);
    // The practice company is untouched.
    expect((await owner.get(`/organisations/${practiceId}/contractors`)).body).toHaveLength(2);
  });

  it('refuses to go live into practice mode, from a live company, or without owner rights', async () => {
    expect((await owner.post(`/organisations/${practiceId}/go-live`, { ...live, chain: 'simulated', network: 'local', executionMode: 'simulated', treasuryAddress: 'sim:x', asset: { address: 'sim:usdc', symbol: 'USDC', decimals: 6 } })).body.error.code).toBe('STILL_PRACTICE');
    expect((await approver.post(`/organisations/${practiceId}/go-live`, live)).status).toBe(403);
    const liveId = (await owner.get('/organisations')).body.find((o: { name: string }) => o.name === 'Live Studio').id;
    expect((await owner.post(`/organisations/${liveId}/go-live`, live)).body.error.code).toBe('ALREADY_LIVE');
  });
});
