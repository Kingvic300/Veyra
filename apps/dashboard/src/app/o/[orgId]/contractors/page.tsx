'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Contractor } from '@veyra/core';
import { useToast } from '@/components/providers';
import { Button, Dialog, Empty, Field, Hash, Input, Notice, PageHeader, Panel, Spinner, Table } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date, explorerUrl } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';

export default function ContractorsPage() {
  const org = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Contractor | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const contractors = useQuery({
    queryKey: [...keys.contractors(org.orgId), showArchived],
    queryFn: () => api.contractors.list(org.orgId, { archived: showArchived }),
  });
  const o = org.data!;
  const canWrite = org.can('contractors:write');

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
      <label className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[var(--color-settle)]" />
        Show archived contractors
      </label>
      {contractors.isLoading ? (
        <Spinner />
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
                <th>Name</th>
                <th>Country</th>
                <th>Payout wallet</th>
                <th>Added</th>
                {canWrite && <th className="sr-only">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {contractors.data?.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'text-ink-faint'}>
                  <td>
                    <span className="font-medium">{c.name}</span>
                    {c.email && <span className="block text-[13px] text-ink-soft">{c.email}</span>}
                  </td>
                  <td>{c.country ?? ''}</td>
                  <td>
                    <Hash value={c.payoutAddress} href={explorerUrl(o.chain, o.network, 'contract', c.payoutAddress)} />
                  </td>
                  <td className="text-ink-soft">{date(c.createdAt)}</td>
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
