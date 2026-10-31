'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Contractor } from '@veyra/core';
import { useToast } from '@/components/providers';
import { Search } from 'lucide-react';
import { countryName } from '@/components/charts';
import { SkeletonRows } from '@/components/loading';
import { Avatar } from '@/components/org-avatar';
import { Button, Dialog, Empty, Field, Hash, Input, Notice, PageHeader, Panel, Table } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { amount, date, explorerUrl } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';

export default function ContractorsPage() {
  const org = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Contractor | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const contractors = useQuery({
    queryKey: [...keys.contractors(org.orgId), showArchived],
    queryFn: () => api.contractors.list(org.orgId, { archived: showArchived }),
  });
  const o = org.data!;
  const canWrite = org.can('contractors:write');
  const stats = useQuery({ queryKey: ['org', o.id, 'stats'], queryFn: () => api.organisations.stats(o.id) });
  const earnings = new Map(stats.data?.contractors?.map((c) => [c.contractorId, c]));
  const list = (contractors.data ?? []).filter(
    (c) => !search || `${c.name} ${c.email ?? ''} ${c.country ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );
  const countries = new Set((contractors.data ?? []).filter((c) => c.active && c.country).map((c) => c.country));

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const input = {
        name: String(form.get('name')),
        email: String(form.get('email') || '') || null,
        country: String(form.get('country') || '') || null,
        payoutAddress: String(form.get('payoutAddress')),
      };
      return editing === 'new' ? api.contractors.create(org.orgId, input) : api.contractors.update(org.orgId, (editing as Contractor).id, input);
    },
    onSuccess: async () => {
      toast('settle', editing === 'new' ? 'Contractor added' : 'Contractor updated');
      setEditing(null);
      await qc.invalidateQueries({ queryKey: keys.contractors(org.orgId) });
    },
  });

  const archive = useMutation({
    mutationFn: (c: Contractor) => (c.active ? api.contractors.archive(org.orgId, c.id) : api.contractors.update(org.orgId, c.id, { active: true })),
    onSuccess: async (c) => {
      toast('neutral', c.active ? 'Contractor restored' : 'Contractor archived');
      await qc.invalidateQueries({ queryKey: keys.contractors(org.orgId) });
    },
    onError: (err) => toast('fail', errorMessage(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate(new FormData(e.currentTarget));
  }

  const current = editing && editing !== 'new' ? editing : null;

  return (
    <>
      <PageHeader
        title="Contractors"
        description="The people you pay and the wallets their money goes to. Names and emails are encrypted in Veyra's database."
        actions={canWrite && <Button onClick={() => setEditing('new')}>Add contractor</Button>}
      />
      <section className="mb-6 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface p-5">
          <p className="text-sm text-ink-soft">Active contractors</p>
          <p className="mt-1.5 text-[22px] font-semibold">{contractors.data ? contractors.data.filter((c) => c.active).length : '—'}</p>
          <p className="mt-0.5 text-[13px] text-ink-faint">in {countries.size} {countries.size === 1 ? 'country' : 'countries'}</p>
        </div>
        <div className="bg-surface p-5">
          <p className="text-sm text-ink-soft">Paid in the last 12 months</p>
          <p className="mt-1.5 text-[22px] font-semibold">
            {stats.data?.contractors ? amount(stats.data.contractors.reduce((a, c) => a + BigInt(c.total), 0n), o.asset) : '—'}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-faint">{stats.data?.completedPayments ?? 0} payments settled</p>
        </div>
        <div className="bg-surface p-5">
          <p className="text-sm text-ink-soft">Top earner</p>
          <p className="mt-1.5 truncate text-[22px] font-semibold">{stats.data?.contractors?.[0]?.name ?? '—'}</p>
          <p className="mt-0.5 text-[13px] text-ink-faint">
            {stats.data?.contractors?.[0] ? amount(stats.data.contractors[0].total, o.asset) : 'No payments yet'}
          </p>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="relative">
          <span className="sr-only">Search contractors</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or country"
            className="h-9 w-72 rounded-control border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-ink-faint focus:border-settle focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[var(--color-settle)]" />
          Show archived
        </label>
      </div>
      {contractors.isLoading ? (
        <SkeletonRows rows={5} />
      ) : contractors.data?.length === 0 ? (
        <Empty
          title="No contractors yet"
          body="Add each person with the wallet address they want to be paid at. You will pick from this list when you build a batch."
          action={canWrite ? <Button size="sm" onClick={() => setEditing('new')}>Add contractor</Button> : undefined}
        />
      ) : (
        <Panel padded={false}>
          <Table>
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Country</th>
                <th>Payout wallet</th>
                <th className="text-right">Paid (12 months)</th>
                <th>Last paid</th>
                {canWrite && <th className="sr-only">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'text-ink-faint'}>
                  <td>
                    <span className="flex items-center gap-3">
                      <Avatar name={c.name} seed={c.id} round />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {c.name}
                          {!c.active && <span className="ml-2 text-[12px] font-normal">Archived</span>}
                        </span>
                        {c.email && <span className="block truncate text-[13px] text-ink-soft">{c.email}</span>}
                      </span>
                    </span>
                  </td>
                  <td>{c.country ? countryName(c.country) : ''}</td>
                  <td>
                    <Hash value={c.payoutAddress} href={explorerUrl(o.chain, o.network, 'contract', c.payoutAddress)} />
                  </td>
                  <td className="text-right font-medium">{earnings.get(c.id) ? amount(earnings.get(c.id)!.total, o.asset) : <span className="font-normal text-ink-faint">Not paid yet</span>}</td>
                  <td className="text-ink-soft">
                    {earnings.get(c.id)?.lastPaidAt ? date(earnings.get(c.id)!.lastPaidAt) : ''}
                    {earnings.get(c.id) && <span className="block text-[12px] text-ink-faint">{earnings.get(c.id)!.payments} payments</span>}
                  </td>
                  {canWrite && (
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => archive.mutate(c)}>
                          {c.active ? 'Archive' : 'Restore'}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={current ? `Edit ${current.name}` : 'Add contractor'}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={current?.name} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <Field label="Email (optional)" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={current?.email ?? ''} />
            </Field>
            <Field label="Country" htmlFor="country" hint="2 letters">
              <Input id="country" name="country" maxLength={2} defaultValue={current?.country ?? ''} placeholder="NG" />
            </Field>
          </div>
          <Field
            label="Payout wallet"
            htmlFor="payoutAddress"
            hint={o.chain === 'simulated' ? 'Use any name starting with sim:, for example sim:ngozi.' : 'The Starknet account that receives the payment. Double-check it with the contractor.'}
          >
            <Input id="payoutAddress" name="payoutAddress" mono required defaultValue={current?.payoutAddress} placeholder={o.chain === 'simulated' ? 'sim:name' : '0x…'} />
          </Field>
          {current && <Notice>Changing the wallet affects batches submitted from now on. Batches already submitted keep the old address.</Notice>}
          {save.error && <Notice tone="fail">{errorMessage(save.error)}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Close
            </Button>
            <Button type="submit" loading={save.isPending}>
              {current ? 'Save changes' : 'Add contractor'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
