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
      <section className="w-full grid grid-cols-1 gap-12 px-5 py-16 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-2">
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

      <section className="w-full px-5 py-16 sm:px-8 lg:px-16 xl:px-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em]">The REST API at a glance</h2>
            <p className="mt-2 max-w-[60ch] text-ink-soft">
              JSON over HTTPS with bearer tokens. Every write is permission-checked and recorded in the audit log.
            </p>
          </div>
          <a href={`${site.githubUrl}/blob/main/docs/api.md`} target="_blank" rel="noreferrer" className="font-medium text-settle hover:underline">
            Full API reference
          </a>
        </div>
        {/* Phones: each row stacks method and path, then the description. */}
        <div className="relative mt-6 overflow-x-auto rounded-panel border border-line bg-surface">
          <table className="w-full text-sm md:min-w-[640px]">
            <tbody>
              {(
                [
                  ['POST', '/v1/organisations/:org/batches', 'Create a draft batch'],
                  ['POST', '/v1/organisations/:org/batches/:id/submit', 'Freeze contents and compute commitments'],
                  ['GET', '/v1/organisations/:org/batches/:id/chain-actions/:kind', 'Unsigned call for the wallet to sign'],
                  ['POST', '/v1/organisations/:org/batches/:id/approvals', 'Record an approval (with tx hash on-chain)'],
                  ['POST', '/v1/organisations/:org/batches/:id/execute', 'Report the settlement transaction'],
                  ['GET', '/v1/organisations/:org/batches/:id/receipt', 'Verified receipt as JSON or CSV'],
                  ['GET', '/v1/organisations/:org/audit/verify', 'Recompute the audit hash chain'],
                ] as const
              ).map(([m, path, what]) => (
                <tr key={path} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-line px-5 py-3.5 first:border-t-0 md:table-row md:p-0">
                  <td className="md:w-20 md:px-5 md:py-3">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[12px] font-medium ${m === 'GET' ? 'bg-wash text-ink-soft' : 'bg-settle-wash text-settle-strong'}`}
                    >
                      {m}
                    </span>
                  </td>
                  <td className="break-all font-mono text-[13px] md:break-normal md:px-5 md:py-3">{path}</td>
                  <td className="col-span-2 text-ink-soft md:px-5 md:py-3">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-line bg-[#f4f7f5]">
        <div className="w-full px-5 py-16 sm:px-8 lg:px-16 xl:px-20">
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Packages</h2>
          <ul className="mt-6 divide-y divide-line rounded-panel border border-line bg-surface">
            {PACKAGES.map(([name, body]) => (
              <li key={name} className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[16rem_1fr]">
                <code className="font-mono text-[13.5px] font-medium">{name}</code>
                <span className="text-[15px] text-ink-soft">{body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="w-full grid grid-cols-1 gap-12 px-5 py-16 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-2">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">How a vault payout flows</h2>
          <ol className="mt-5 flex list-decimal flex-col gap-2 pl-5 text-[15px] text-ink-soft">
            <li>The API freezes the batch and computes its Poseidon items hash.</li>
            <li>
              A wallet calls <code className="font-mono text-[13px]">propose_batch</code> with that hash.
            </li>
            <li>
              Each approver wallet calls <code className="font-mono text-[13px]">approve_batch</code>.
            </li>
            <li>
              An executor calls <code className="font-mono text-[13px]">execute_batch</code> with the recipients and amounts; the contract rechecks
              the hash and pays everyone atomically.
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
