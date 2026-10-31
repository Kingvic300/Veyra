'use client';

import clsx from 'clsx';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';
import type { BatchStatus, PrivacyCapabilities, Visibility } from '@veyra/core';
import type { BatchDetail } from '@veyra/sdk';
import { explorerUrl, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { Hash, Pill } from './ui';

export function StatusPill({ status }: { status: BatchStatus }) {
  const live = status === 'EXECUTING' || status === 'PENDING_APPROVAL';
  return (
    <Pill tone={STATUS_TONE[status]} live={live}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

type StepState = 'done' | 'current' | 'waiting' | 'failed' | 'skipped';
interface Step {
  label: string;
  detail: string;
  state: StepState;
  tx?: string | null;
}

/** Derive the settlement steps from a batch. The rail is the core visual of Veyra. */
export function railSteps(batch: BatchDetail, requiresProposal: boolean): Step[] {
  const s = batch.status;
  const after = (states: BatchStatus[]) => states.includes(s);
  const submitted = !after(['DRAFT']) && !!batch.submittedAt;
  const lastExecution = batch.executions?.at(-1);
  const approvals = batch.approvalSummary;

  const steps: Step[] = [
    { label: 'Drafted', detail: `${batch.itemCount} ${batch.itemCount === 1 ? 'payment' : 'payments'}`, state: 'done' },
    {
      label: 'Sent for approval',
      detail: submitted ? 'Locked for review' : 'Review and send',
      state: submitted ? 'done' : s === 'CANCELLED' ? 'skipped' : 'current',
    },
  ];
  if (requiresProposal) {
    const p = batch.proposal.status;
    steps.push({
      label: 'Added to vault',
      detail: p === 'CONFIRMED' ? 'The vault has this payout' : p === 'PENDING' ? 'Waiting for the network' : p === 'FAILED' ? 'Could not add to vault' : 'Confirm in your wallet',
      state: p === 'CONFIRMED' ? 'done' : p === 'FAILED' ? 'failed' : submitted && s !== 'CANCELLED' ? 'current' : 'waiting',
      tx: batch.proposal.txHash,
    });
  }
  const approved = after(['APPROVED', 'EXECUTING', 'COMPLETED', 'FAILED']);
  steps.push({
    label: 'Approved',
    detail: `${approvals.confirmed} of ${approvals.required}${approvals.pending ? `, ${approvals.pending} confirming` : ''}`,
    state: approved ? 'done' : s === 'PENDING_APPROVAL' && (!requiresProposal || batch.proposal.status === 'CONFIRMED') ? 'current' : 'waiting',
  });
  steps.push({
    label: 'Paid',
    detail: s === 'COMPLETED' ? 'Settled' : s === 'EXECUTING' ? 'Settling' : s === 'FAILED' ? 'Failed, no money moved. Safe to retry' : 'After approval',
    state: s === 'COMPLETED' ? 'done' : s === 'FAILED' ? 'failed' : s === 'EXECUTING' || s === 'APPROVED' ? 'current' : 'waiting',
    tx: lastExecution?.txHash,
  });
  const v = lastExecution?.verification;
  steps.push({
    label: 'Verified',
    detail: v ? (v.verified ? (v.method === 'transaction-status' ? 'Payment confirmed' : 'Matches the blockchain record') : 'Does not match') : 'Checked after payment',
    state: v?.verified && s === 'COMPLETED' ? 'done' : v && !v.verified ? 'failed' : 'waiting',
  });
  if (s === 'CANCELLED') for (const step of steps) if (step.state !== 'done') step.state = 'skipped';
  return steps;
}

export function SettlementRail({ batch, chain, network, requiresProposal }: { batch: BatchDetail; chain: string; network: string; requiresProposal: boolean }) {
  const steps = railSteps(batch, requiresProposal);
  return (
    <ol className="grid gap-y-5 sm:grid-flow-col sm:auto-cols-fr" aria-label="Payment progress">
      {steps.map((step, i) => {
        const next = steps[i + 1];
        return (
          <li key={step.label} className="relative flex gap-3 sm:block" aria-current={step.state === 'current' ? 'step' : undefined}>
            {/* connector to the next stop */}
            {next && (
              <span className="absolute left-[11px] top-7 h-[calc(100%-4px)] w-0.5 bg-line sm:left-7 sm:right-0 sm:top-[11px] sm:h-0.5 sm:w-auto" aria-hidden>
                {step.state === 'done' && (next.state === 'done' || next.state === 'current') && (
                  <span className="rail-segment-done block size-full bg-settle" />
                )}
              </span>
            )}
            <span
              className={clsx(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                step.state === 'done' && 'border-settle bg-settle text-white',
                step.state === 'current' && 'border-pending bg-surface',
                step.state === 'failed' && 'border-fail bg-fail text-white',
                (step.state === 'waiting' || step.state === 'skipped') && 'border-line-strong bg-surface',
              )}
            >
              {step.state === 'done' && <Check className="size-3.5" strokeWidth={3} />}
              {step.state === 'failed' && <X className="size-3.5" strokeWidth={3} />}
              {step.state === 'current' && <span className="dot-live size-2 rounded-full bg-pending" />}
            </span>
            <div className="min-w-0 sm:mt-3 sm:pr-3">
              <p className={clsx('text-sm font-semibold', (step.state === 'waiting' || step.state === 'skipped') && 'text-ink-faint')}>{step.label}</p>
              <p className="text-[13px] text-ink-soft">{step.detail}</p>
              {step.tx && (
                <Hash value={step.tx} href={explorerUrl(chain, network, 'tx', step.tx)} className="mt-1.5" />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const VIS_LABEL: Record<Visibility, string> = {
  public: 'Public on the blockchain',
  hidden: 'Hidden',
  'encrypted-offchain': 'Encrypted, visible to your team',
  'not-stored': 'Not published anywhere',
};

const FIELDS: [keyof PrivacyCapabilities['visibility'], string][] = [
  ['contractorIdentity', 'Names and emails'],
  ['recipientAddresses', 'Recipient wallets'],
  ['amounts', 'Individual amounts'],
  ['batchTotal', 'Batch total'],
  ['approvals', 'Who approved'],
  ['timing', 'When it was paid'],
];

/** Plain statement of what an outsider can see. Never implies more privacy than the mode gives. */
export function PrivacyPanel({ privacy }: { privacy: PrivacyCapabilities }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {privacy.shieldedTransfers ? <EyeOff className="size-4 text-settle" /> : <Eye className="size-4 text-ink-soft" />}
        <p className="font-semibold">{privacy.label}</p>
        {privacy.maturity === 'experimental' && <Pill tone="pending">Experimental</Pill>}
      </div>
      <dl className="mt-4 divide-y divide-line text-sm">
        {FIELDS.map(([key, label]) => {
          const v = privacy.visibility[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-ink-soft">{label}</dt>
              <dd className={clsx('flex items-center gap-1.5 text-right', v === 'public' ? 'text-ink' : 'text-settle-strong')}>
                {v !== 'public' && <Lock className="size-3.5" aria-hidden />}
                {VIS_LABEL[v]}
              </dd>
            </div>
          );
        })}
      </dl>
      <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-ink-soft">
        {privacy.disclosures.map((d) => (
          <li key={d} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" aria-hidden />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}
