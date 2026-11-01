'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { formatUnits, parseUnits } from '@veyra/core';
import { PrivacyPanel } from '@/components/batch-bits';
import { useToast } from '@/components/providers';
import { Button, Field, Hash, Input, PageHeader, Panel, PrefixInput } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { networkLabel } from '@/lib/format';
import { keys, useCapabilities, useOrg } from '@/lib/hooks';

export default function SettingsPage() {
  const org = useOrg();
  const caps = useCapabilities();
  const qc = useQueryClient();
  const toast = useToast();
  const o = org.data!;

  const save = useMutation({
    mutationFn: (f: FormData) => {
      const limit = String(f.get('limit') || '').trim();
      return api.organisations.update(o.id, {
        name: String(f.get('name')),
        treasuryAddress: String(f.get('treasury') || '').trim() || null,
        approvalPolicy: {
          threshold: Number(f.get('threshold')),
          allowCreatorApproval: f.get('creatorApproves') === 'on',
          maxBatchTotal: limit ? parseUnits(limit, o.asset.decimals).toString() : null,
        },
      });
    },
    onSuccess: async () => {
      toast('settle', 'Settings saved');
      await qc.invalidateQueries({ queryKey: keys.org(o.id) });
      await qc.invalidateQueries({ queryKey: keys.treasury(o.id) });
    },
    onError: (err) => toast('fail', errorMessage(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      save.mutate(new FormData(e.currentTarget));
    } catch (err) {
      toast('fail', errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Where payroll is paid from and who must approve it. Every change is saved in your history." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <form onSubmit={onSubmit} className="flex flex-col gap-6 rounded-panel border border-line bg-surface p-6">
          <Field label="Company name" htmlFor="name">
            <Input id="name" name="name" defaultValue={o.name} required />
          </Field>
          <Field
            label={o.executionMode === 'wallet' ? 'Paying wallet' : o.executionMode === 'vault' ? 'PayrollVault contract' : o.executionMode === 'strk20-private' ? 'Paying account' : 'Practice account'}
            htmlFor="treasury"
            hint="Payouts already sent for approval keep the account they were sent with."
          >
            {o.chain === 'simulated' ? (
              <PrefixInput id="treasury" name="treasury" prefix="sim:" lowercase defaultValue={o.treasuryAddress ?? ''} placeholder="treasury" />
            ) : (
              <Input id="treasury" name="treasury" mono defaultValue={o.treasuryAddress ?? ''} placeholder="0x…" />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Approvals needed" htmlFor="threshold" hint={o.executionMode === 'vault' ? 'Must match the number set in your vault contract.' : undefined}>
              <Input id="threshold" name="threshold" type="number" min={1} max={20} defaultValue={o.approvalPolicy.threshold} required />
            </Field>
            <Field label={`Largest payout allowed (${o.asset.symbol})`} htmlFor="limit" hint="Leave empty for no limit.">
              <Input
                id="limit"
                name="limit"
                inputMode="decimal"
                defaultValue={o.approvalPolicy.maxBatchTotal ? formatUnits(o.approvalPolicy.maxBatchTotal, o.asset.decimals) : ''}
              />
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="creatorApproves" defaultChecked={o.approvalPolicy.allowCreatorApproval} className="mt-0.5 accent-[var(--color-settle)]" />
            <span>
              The person who creates a payout can also approve it
              <span className="block text-ink-faint">Leave off so preparing and approving stay with different people.</span>
            </span>
          </label>
          <div>
            <Button type="submit" loading={save.isPending}>
              Save settings
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-8">
          {o.chain === 'simulated' && (
            <Panel title="Go live">
              <p className="text-sm text-ink-soft">
                This company uses practice money. Going live creates a new company that pays with real money and copies your team, approval rules
                and people. This practice company stays as it is.
              </p>
              <Link href={`/onboarding?from=${o.id}`} className="mt-4 inline-block">
                <Button>Go live</Button>
              </Link>
            </Panel>
          )}
          <Panel title="Network">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Runs on</dt>
                <dd>{networkLabel(o.chain, o.network)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Asset</dt>
                <dd className="flex items-center gap-2">
                  {o.asset.symbol} <Hash value={o.asset.address} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Confirmed after</dt>
                <dd>{caps.data?.finality}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">People per payout</dt>
                <dd>Up to {caps.data?.maxBatchSize}</dd>
              </div>
            </dl>
          </Panel>
          {caps.data && (
            <Panel title="Who can see what">
              <PrivacyPanel privacy={caps.data.privacy} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
