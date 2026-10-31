import type { Metadata } from 'next';
import { FileCheck, Fingerprint, KeyRound, Lock, ShieldCheck, Users } from 'lucide-react';
import { MarketingPage } from '@/components/marketing/legal-page';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Security and privacy' };

const CONTROLS = [
  {
    icon: ShieldCheck,
    title: 'Approvals enforced by a contract',
    body: 'In vault mode the PayrollVault contract releases funds only after the required number of approver wallets sign. A compromised Veyra server cannot pay anyone on its own.',
  },
  {
    icon: Fingerprint,
    title: 'Approvers sign the exact list',
    body: 'Submitting a batch fixes a Poseidon hash of every recipient and amount. Execution recomputes it on-chain, so a changed address or amount is rejected.',
  },
  {
    icon: Lock,
    title: 'Encrypted payroll records',
    body: 'Contractor names, emails, payout wallets and per-person amounts are sealed with AES-256-GCM using a key unique to your organisation, itself wrapped by a server master key.',
  },
  {
    icon: FileCheck,
    title: 'Tamper-evident audit log',
    body: 'Every change is appended to a hash chain. Editing or deleting any past entry breaks the chain, and anyone with access can re-verify it from the audit page.',
  },
  {
    icon: Users,
    title: 'Roles and separation of duties',
    body: 'Owners, admins, approvers and viewers see and do different things. By default the person who prepares a batch cannot approve it.',
  },
  {
    icon: KeyRound,
    title: 'No keys on our servers',
    body: 'Veyra never asks for private keys or seed phrases. Your wallet shows each transaction and signs it; we only receive the transaction hash.',
  },
];

export default function SecurityPage() {
  return (
    <MarketingPage
      title="Security that does not depend on trusting us"
      intro="Veyra is built so the most important rules hold even if our servers are compromised: money moves only when your approvers sign, and only to the recipients they saw."
    >
      <section className="w-full px-5 py-16 sm:px-8 lg:px-16 xl:px-20">
        <div className="grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
          {CONTROLS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-surface p-7">
              <span className="flex size-10 items-center justify-center rounded-[10px] bg-settle-wash text-settle">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-[#f4f7f5]">
        <div className="w-full grid gap-12 px-5 py-20 sm:px-8 lg:px-16 xl:px-20 lg:grid-cols-2">
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.025em]">What stays visible</h2>
            <div className="prose-veyra">
              <p>
                Privacy on a public blockchain has limits, and we would rather you hear them from us. In the <strong>payroll vault</strong> mode,
                recipient wallets, amounts, totals, approver wallets and timing are public on Starknet. Names and emails never leave Veyra.
              </p>
              <p>
                In the experimental <strong>STRK20</strong> mode, transfers inside the privacy pool hide the sender, recipient and amount, but funding
                the pool and withdrawing from it are public, and so is the fact that your paying account uses the pool. Approvals in this mode are
                enforced by Veyra rather than by a contract.
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.025em]">Where we are today</h2>
            <ul className="mt-5 flex flex-col gap-3 text-[15px]">
              {[
                ['Done', 'Contract test suite covering approvals, tampering, replay and failed transfers'],
                ['Done', 'Cross-checking every payment against vault and token events'],
                ['Done', 'Encrypted fields, hash-chained audit log, CSRF-protected sessions'],
                ['In progress', 'Independent smart contract audit before mainnet use'],
                ['Planned', 'Published threat model review and a bug bounty'],
              ].map(([state, text]) => (
                <li key={text} className="flex items-start gap-3 rounded-control border border-line bg-surface px-4 py-3">
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${state === 'Done' ? 'bg-settle-wash text-settle-strong' : state === 'In progress' ? 'bg-pending-wash text-pending' : 'bg-wash text-ink-soft'}`}
                  >
                    {state}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="w-full px-5 py-20 sm:px-8 lg:px-16 xl:px-20">
        <h2 className="text-[30px] font-semibold tracking-[-0.025em]">Report a vulnerability</h2>
        <p className="mt-3 max-w-[60ch] text-[16px] text-ink-soft">
          Email{' '}
          <a className="font-medium text-settle underline" href={`mailto:${site.emails.security}`}>
            {site.emails.security}
          </a>{' '}
          with the steps to reproduce. We reply within two working days, keep you updated, and credit you if you wish. Please do not test against
          other customers&apos; data or move real funds.
        </p>
      </section>
    </MarketingPage>
  );
}
