import type { Metadata } from 'next';
import { MarketingPage } from '@/components/marketing/legal-page';
import { GithubMark } from '@/components/marketing/chrome';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Developers' };

const PACKAGES = [
  ['@veyra/core', 'Domain model, state machines, approval policy, audit chain and shared schemas.'],
  ['@veyra/chain-adapter', 'The adapter interface every network implements, plus a simulated ledger for tests.'],
  ['@veyra/starknet-adapter', 'PayrollVault calls, Poseidon items hash, receipt verification and STRK20 actions.'],
  ['@veyra/sdk', 'Typed client for the REST API, for scripts, back offices and integrations.'],
  ['veyra_contracts', 'Cairo PayrollVault contract with snforge tests.'],
];

const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-panel border border-line bg-ink p-5 font-mono text-[13px] leading-relaxed text-[#d9e6df]">{children}</pre>
);

export default function DevelopersPage() {
  return (
    <MarketingPage
      title="Build on the payroll core"
      intro="Everything that runs the hosted service is in the open: the API, the contracts, the chain adapters and the SDK. Integrate with it, self-host it, or add a network."
    >
      <section className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Run it locally</h2>
          <p className="mt-2 text-ink-soft">Postgres and Redis in Docker, the API on port 4000 and the dashboard on port 3000.</p>
          <div className="mt-5">
            <Code>{`git clone ${site.githubUrl}.git
cd Veyra
npm install
npm run services:up
cp apps/api/.env.example apps/api/.env   # add secrets
npm run build
npm run dev:api
npm run dev:dashboard
node scripts/seed-demo.mjs               # optional demo data`}</Code>
          </div>
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-control bg-ink px-5 text-sm font-medium text-white hover:bg-settle-strong"
          >
            <GithubMark className="size-4" /> View on GitHub
          </a>
        </div>
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Use the SDK</h2>
          <p className="mt-2 text-ink-soft">Authenticate with a bearer token and drive the full lifecycle from code.</p>
          <div className="mt-5">
            <Code>{`import { VeyraClient } from '@veyra/sdk';

const veyra = new VeyraClient({ baseUrl: 'https://api.example.com/v1' });
await veyra.auth.login({ email, password });

const batch = await veyra.batches.create(orgId, {
  title: 'November contractors',
  items: contractors.map((c) => ({ contractorId: c.id, amount: c.rate })),
});
const report = await veyra.batches.validate(orgId, batch.id);
if (report.ok) await veyra.batches.submit(orgId, batch.id);

// Later: fetch the verified receipt
const receipt = await veyra.batches.receipt(orgId, batch.id);`}</Code>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-[#f4f7f5]">
        <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Packages</h2>
          <ul className="mt-6 divide-y divide-line rounded-panel border border-line bg-surface">
            {PACKAGES.map(([name, body]) => (
              <li key={name} className="grid gap-1 px-5 py-4 sm:grid-cols-[16rem_1fr]">
                <code className="font-mono text-[13.5px] font-medium">{name}</code>
                <span className="text-[15px] text-ink-soft">{body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">How a vault payout flows</h2>
          <ol className="mt-5 flex list-decimal flex-col gap-2 pl-5 text-[15px] text-ink-soft">
            <li>The API freezes the batch and computes its Poseidon items hash.</li>
            <li>A wallet calls <code className="font-mono text-[13px]">propose_batch</code> with that hash.</li>
            <li>Each approver wallet calls <code className="font-mono text-[13px]">approve_batch</code>.</li>
            <li>
              An executor calls <code className="font-mono text-[13px]">execute_batch</code> with the recipients and amounts; the contract rechecks the
              hash and pays everyone atomically.
            </li>
            <li>The API reads the receipt and matches every PaymentSent and token Transfer event.</li>
          </ol>
        </div>
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Add a network</h2>
          <p className="mt-3 text-[15px] text-ink-soft">
            Implement the <code className="font-mono text-[13px]">ChainAdapter</code> interface: address rules, balance reads, unsigned transactions,
            transaction status and payment verification. Declare what the network can and cannot do in its capabilities, including its privacy model.
            The payroll core does not change.
          </p>
        </div>
      </section>
    </MarketingPage>
  );
}
