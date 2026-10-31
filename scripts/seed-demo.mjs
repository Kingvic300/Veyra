#!/usr/bin/env node
// Seed a demo organisation on the simulated ledger through the public API.
// Usage: node scripts/seed-demo.mjs [apiBaseUrl]
// Creates three accounts (password: "veyra demo password") and walks one batch
// through approval and payment so every dashboard screen has data.

import { VeyraApiError, VeyraClient } from '@veyra/sdk';

const baseUrl = process.argv[2] ?? process.env.VEYRA_API_URL ?? 'http://localhost:4000/v1';
const password = 'veyra demo password';

async function account(email, name) {
  const c = new VeyraClient({ baseUrl });
  try {
    await c.auth.register({ email, name, password });
  } catch (err) {
    if (!(err instanceof VeyraApiError && err.code === 'EMAIL_TAKEN')) throw err;
    await c.auth.login({ email, password });
  }
  return c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const owner = await account('ada@demo.veyra.dev', 'Adaeze Okonkwo');
const approver = await account('tunde@demo.veyra.dev', 'Tunde Bakare');
const finance = await account('wanjiru@demo.veyra.dev', 'Wanjiru Kamau');

const org = await owner.organisations.create({
  name: 'Lagos Dev Studio',
  chain: 'simulated',
  network: 'local',
  executionMode: 'simulated',
  treasuryAddress: 'sim:lagos-studio-treasury',
  asset: { address: 'sim:usdc', symbol: 'USDC', decimals: 6 },
  approvalPolicy: { threshold: 2, allowCreatorApproval: false, maxBatchTotal: null },
});
await owner.members.add(org.id, { email: 'tunde@demo.veyra.dev', role: 'APPROVER' });
await owner.members.add(org.id, { email: 'wanjiru@demo.veyra.dev', role: 'ADMIN' });

const people = [
  ['Ngozi Okafor', 'NG', 'sim:ngozi', '2400'],
  ['Kwame Mensah', 'GH', 'sim:kwame', '1850.50'],
  ['Amara Diallo', 'SN', 'sim:amara', '1600'],
  ['Thandiwe Nkosi', 'ZA', 'sim:thandiwe', '2100'],
  ['Yusuf Abdi', 'KE', 'sim:yusuf', '1275.25'],
];
const contractors = [];
for (const [name, country, payoutAddress] of people) {
  contractors.push(
    await owner.contractors.create(org.id, { name, country, payoutAddress, email: `${payoutAddress.slice(4)}@contractors.dev` }),
  );
}

// September: fully paid.
const september = await owner.batches.create(org.id, {
  title: 'September 2026 contractors',
  items: contractors.map((c, i) => ({ contractorId: c.id, amount: people[i][3] })),
});
await owner.batches.submit(org.id, september.id);
await approver.batches.approve(org.id, september.id);
await finance.batches.approve(org.id, september.id);
await owner.batches.execute(org.id, september.id);
for (let i = 0; i < 20; i++) {
  const b = await owner.batches.get(org.id, september.id);
  if (b.status === 'COMPLETED') break;
  await sleep(500);
}

// October: waiting for a second approval.
const october = await owner.batches.create(org.id, {
  title: 'October 2026 contractors',
  items: contractors.slice(0, 4).map((c, i) => ({ contractorId: c.id, amount: people[i][3] })),
});
await owner.batches.submit(org.id, october.id);
await approver.batches.approve(org.id, october.id);

// A draft bonus run.
await owner.batches.create(org.id, {
  title: 'Q4 delivery bonus',
  items: contractors.slice(1, 3).map((c) => ({ contractorId: c.id, amount: '500' })),
});

console.log(`Seeded organisation ${org.name} (${org.id})`);
console.log(`Sign in as ada@demo.veyra.dev, tunde@demo.veyra.dev or wanjiru@demo.veyra.dev with password "${password}"`);
