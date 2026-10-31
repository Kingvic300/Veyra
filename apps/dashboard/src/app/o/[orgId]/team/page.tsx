'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ROLES, type Member, type Role } from '@veyra/core';
import { useToast, useWallet } from '@/components/providers';
import { Button, Dialog, Field, Hash, Input, Notice, PageHeader, Panel, Select, Spinner, Table } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { explorerUrl } from '@/lib/format';
import { keys, useMe, useOrg } from '@/lib/hooks';

const ROLE_COPY: Record<Role, string> = {
  OWNER: 'Everything, including adding owners',
  ADMIN: 'Manage the team, contractors and batches; approve and pay',
  APPROVER: 'Review and approve batches',
  VIEWER: 'See totals, treasury and the audit log, not contractor details',
};

const label = (r: Role) => r.charAt(0) + r.slice(1).toLowerCase();

export default function TeamPage() {
  const org = useOrg();
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const { wallet } = useWallet();
  const [adding, setAdding] = useState(false);
  const members = useQuery({ queryKey: keys.members(org.orgId), queryFn: () => api.members.list(org.orgId) });
  const o = org.data!;
  const manage = org.can('members:manage');
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.members(org.orgId) });

  const add = useMutation({
    mutationFn: (f: FormData) =>
      api.members.add(org.orgId, {
        email: String(f.get('email')),
        role: String(f.get('role')) as Role,
        walletAddress: String(f.get('wallet') || '') || null,
      }),
    onSuccess: async () => {
      setAdding(false);
      toast('settle', 'Teammate added');
      await invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ m, patch }: { m: Member; patch: { role?: Role; walletAddress?: string | null } }) => api.members.update(org.orgId, m.id, patch),
    onSuccess: async () => {
      toast('settle', 'Saved');
      await invalidate();
    },
    onError: (err) => toast('fail', errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (m: Member) => api.members.remove(org.orgId, m.id),
    onSuccess: async () => {
      toast('neutral', 'Teammate removed');
      await invalidate();
    },
    onError: (err) => toast('fail', errorMessage(err)),
  });

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    add.mutate(new FormData(e.currentTarget));
  }

  const self = members.data?.find((m) => m.userId === me.data?.id);
  const onChain = o.executionMode === 'vault';

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can prepare, approve and pay. Approvals count only from people whose role allows it."
        actions={manage && <Button onClick={() => setAdding(true)}>Add teammate</Button>}
      />

      {onChain && self && !self.walletAddress && (
        <div className="mb-6">
          <Notice tone="pending" title="Link your approver wallet">
            The vault checks approvals by wallet. Connect the wallet you approve with, then link it below.
            {wallet && (
              <div className="mt-3">
                <Button size="sm" onClick={() => update.mutate({ m: self, patch: { walletAddress: wallet.address } })} loading={update.isPending}>
                  Link {wallet.name} wallet
                </Button>
              </div>
            )}
          </Notice>
        </div>
      )}

      {members.isLoading ? (
        <Spinner />
      ) : (
        <Panel padded={false}>
          <Table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>{onChain ? 'Approver wallet' : 'Wallet'}</th>
                {manage && <th className="sr-only">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.data?.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="font-medium">
                      {m.name}
                      {m.id === self?.id && <span className="ml-2 text-[12.5px] font-normal text-ink-faint">You</span>}
                    </span>
                    <span className="block text-[13px] text-ink-soft">{m.email}</span>
                  </td>
                  <td>
                    {manage && m.id !== self?.id ? (
                      <Select
                        value={m.role}
                        onChange={(e) => update.mutate({ m, patch: { role: e.target.value as Role } })}
                        className="h-9 w-36"
                        aria-label={`Role for ${m.name}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {label(r)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span title={ROLE_COPY[m.role]}>{label(m.role)}</span>
                    )}
                  </td>
                  <td>
                    {m.walletAddress ? (
                      <Hash value={m.walletAddress} href={explorerUrl(o.chain, o.network, 'contract', m.walletAddress)} />
                    ) : (
                      <span className="text-[13px] text-ink-faint">Not linked</span>
                    )}
                    {m.id === self?.id && wallet && m.walletAddress && BigInt(m.walletAddress) !== BigInt(wallet.address) && (
                      <button
                        type="button"
                        className="ml-2 text-[12.5px] font-medium text-settle hover:underline"
                        onClick={() => update.mutate({ m, patch: { walletAddress: wallet.address } })}
                      >
                        Use connected wallet
                      </button>
                    )}
                  </td>
                  {manage && (
                    <td className="text-right">
                      {m.id !== self?.id && (
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(m)}>
                          Remove
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
        {ROLES.map((r) => (
          <div key={r} className="rounded-control border border-line bg-surface px-4 py-3">
            <dt className="font-medium">{label(r)}</dt>
            <dd className="text-ink-soft">{ROLE_COPY[r]}</dd>
          </div>
        ))}
      </dl>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a teammate">
        <form onSubmit={onAdd} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email" hint="They need a Veyra account with this email.">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="Role" htmlFor="role">
            <Select id="role" name="role" defaultValue="APPROVER">
              {ROLES.filter((r) => r !== 'OWNER' || org.data?.role === 'OWNER').map((r) => (
                <option key={r} value={r}>
                  {label(r)}: {ROLE_COPY[r]}
                </option>
              ))}
            </Select>
          </Field>
          {onChain && (
            <Field label="Approver wallet (optional)" htmlFor="wallet" hint="Must also be an approver in the PayrollVault contract.">
              <Input id="wallet" name="wallet" mono placeholder="0x…" />
            </Field>
          )}
          {add.error && <Notice tone="fail">{errorMessage(add.error)}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Close
            </Button>
            <Button type="submit" loading={add.isPending}>
              Add teammate
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
