'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { formatUnits, parseUnits } from '@veyra/core';
import { PrivacyPanel } from '@/components/batch-bits';
import { useToast } from '@/components/providers';
import { Button, Field, Hash, Input, Notice, PageHeader, Panel } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { networkLabel } from '@/lib/format';
import { keys, useCapabilities, useOrg } from '@/lib/hooks';

export default function SettingsPage() {
  const org = useOrg();
  const caps = useCapabilities();
  const qc = useQueryClient();
  const toast = useToast();
  const o = org.data!;
  const [error, setError] = useState<string | null>(null);

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
    onError: (err) => setError(errorMessage(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      save.mutate(new FormData(e.currentTarget));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Treasury and approval rules. Every change is written to the audit log." />
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={onSubmit} className="flex flex-col gap-6 rounded-panel border border-line bg-surface p-6">
          <Field label="Organisation name" htmlFor="name">
            <Input id="name" name="name" defaultValue={o.name} required />
          </Field>
          <Field
            label={o.executionMode === 'vault' ? 'PayrollVault contract' : o.executionMode === 'strk20-private' ? 'Paying account' : 'Treasury account'}
            htmlFor="treasury"
            hint="Batches already submitted keep the treasury they were submitted with."
          >
            <Input id="treasury" name="treasury" mono defaultValue={o.treasuryAddress ?? ''} placeholder="0x…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Approvals needed" htmlFor="threshold" hint={o.executionMode === 'vault' ? 'Keep equal to the vault threshold.' : undefined}>
              <Input id="threshold" name="threshold" type="number" min={1} max={20} defaultValue={o.approvalPolicy.threshold} required />
            </Field>
            <Field label={`Largest batch allowed (${o.asset.symbol})`} htmlFor="limit" hint="Leave empty for no limit.">
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
              Let the person who creates a batch also approve it
              <span className="block text-ink-faint">Leave off so preparing and approving stay with different people.</span>
            </span>
          </label>
          {error && <Notice tone="fail">{error}</Notice>}
          <div>
            <Button type="submit" loading={save.isPending}>
              Save settings
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-8">
          <Panel title="Network">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Settles on</dt>
                <dd>{networkLabel(o.chain, o.network)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Asset</dt>
                <dd className="flex items-center gap-2">
                  {o.asset.symbol} <Hash value={o.asset.address} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Final after</dt>
                <dd>{caps.data?.finality}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Payments per batch</dt>
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
