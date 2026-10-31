'use client';

import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Button, Notice, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { amount, date, explorerUrl, networkLabel, STATUS_LABEL } from '@/lib/format';
import { useOrg } from '@/lib/hooks';

/** Printable receipt. Every value can be checked against the chain or the audit chain. */
export default function ReceiptPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const org = useOrg();
  const receipt = useQuery({ queryKey: ['receipt', batchId], queryFn: () => api.batches.receipt(org.orgId, batchId), staleTime: Infinity });

  if (receipt.isLoading) return <Spinner />;
  if (!receipt.data) return <Notice tone="fail">{errorMessage(receipt.error)}</Notice>;
  const r = receipt.data;
  const b = r.batch;
  const tx = r.execution?.txHash;
  const txUrl = tx ? explorerUrl(b.chain, b.network, 'tx', tx) : null;

  return (
    <>
      <div className="no-print mb-6 flex justify-between">
        <Link href={`/o/${org.orgId}/batches/${batchId}`} className="text-sm text-ink-soft hover:text-ink">
          Back to payout
        </Link>
        <Button variant="secondary" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>

      <article className="rounded-panel border border-line bg-surface p-8 print:border-0 print:p-0 sm:p-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-8">
          <div>
            <Logo />
            <h1 className="mt-8 text-[26px] font-semibold">Payroll receipt</h1>
            <p className="mt-1 text-ink-soft">
              {r.organisation.name}, {b.title}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-ink-soft">Status</dt>
            <dd className="font-medium">{STATUS_LABEL[b.status]}</dd>
            <dt className="text-ink-soft">Network</dt>
            <dd>{networkLabel(b.chain, b.network)}</dd>
            <dt className="text-ink-soft">Paid on</dt>
            <dd>{date(r.execution?.finalisedAt, true) || 'Not yet'}</dd>
            <dt className="text-ink-soft">Issued</dt>
            <dd>{date(r.generatedAt, true)}</dd>
          </dl>
        </header>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="text-left text-[12.5px] text-ink-faint">
              <th className="pb-2 font-medium">Paid to</th>
              <th className="pb-2 font-medium">Wallet</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((i) => (
              <tr key={i.recipient} className="border-t border-line">
                <td className="py-3 font-medium">{i.contractorName}</td>
                <td className="py-3 font-mono text-[12px] text-ink-soft break-all">{i.recipient}</td>
                <td className="py-3 text-right font-medium">{amount(i.amount, b.asset)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink">
              <td className="pt-3 font-semibold" colSpan={2}>
                Total
              </td>
              <td className="pt-3 text-right text-lg font-semibold">{amount(b.total, b.asset)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">Approved by</h2>
            <ul className="mt-2 text-sm">
              {r.approvals
                .filter((a) => a.status === 'CONFIRMED')
                .map((a) => (
                  <li key={a.memberName + a.confirmedAt} className="py-1">
                    {a.memberName} <span className="text-ink-faint">on {date(a.confirmedAt, true)}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">Verification</h2>
            <p className="mt-2 text-sm text-ink-soft">
              {r.execution?.verification
                ? r.execution.verification.verified
                  ? r.execution.verification.method === 'onchain-events'
                    ? 'Every payment matches what the blockchain recorded for this transaction.'
                    : r.execution.verification.method === 'transaction-status'
                      ? 'The payment went through. Amounts are hidden, so nobody outside your team can check them.'
                      : 'Paid in practice mode. No real money moved.'
                  : `Mismatch: ${r.execution.verification.mismatches.join('; ')}`
                : 'Not paid yet.'}
            </p>
          </div>
        </section>

        <section className="mt-10 border-t border-line pt-6 text-[12.5px]">
          <h2 className="mb-3 text-sm font-semibold">References</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]">
            {tx && (
              <>
                <dt className="text-ink-soft">Payment transaction</dt>
                <dd className="font-mono break-all">{txUrl ? <a href={txUrl} className="text-settle underline">{tx}</a> : tx}</dd>
              </>
            )}
            {b.treasuryAddress && (
              <>
                <dt className="text-ink-soft">Paid from</dt>
                <dd className="font-mono break-all">{b.treasuryAddress}</dd>
              </>
            )}
            <dt className="text-ink-soft">Token</dt>
            <dd className="font-mono break-all">
              {b.asset.symbol} {b.asset.address}
            </dd>
            {b.commitment && (
              <>
                <dt className="text-ink-soft">Payout fingerprint</dt>
                <dd className="font-mono break-all">{b.commitment}</dd>
              </>
            )}
            {b.chainItemsHash && (
              <>
                <dt className="text-ink-soft">Vault fingerprint</dt>
                <dd className="font-mono break-all">{b.chainItemsHash}</dd>
              </>
            )}
            <dt className="text-ink-soft">Last history entry</dt>
            <dd className="font-mono break-all">{r.auditTrail.at(-1)?.hash}</dd>
          </dl>
          <p className="mt-6 text-ink-faint">{r.privacy.label}. {r.privacy.disclosures[0]}</p>
        </section>
      </article>
    </>
  );
}
