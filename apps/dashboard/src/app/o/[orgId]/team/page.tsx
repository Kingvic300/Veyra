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
  ADMIN: 'Manage the team, people and payouts. Can approve and pay.',
  APPROVER: 'Check and approve payouts',
  VIEWER: 'See totals, funds and history, but not who is paid what',
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
  const invites = useQuery({ queryKey: [...keys.members(org.orgId), 'invitations'], queryFn: () => api.invitations.list(org.orgId) });
  const o = org.data!;
  const manage = org.can('members:manage');
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.members(org.orgId) });

  const add = useMutation({
    mutationFn: (f: FormData) =>
      api.invitations.invite(org.orgId, {
        email: String(f.get('email')).trim(),
        role: String(f.get('role')) as Role,
        walletAddress: String(f.get('wallet') || '') || null,
      }),
    onSuccess: async (r) => {
      setAdding(false);
      if (r.status === 'added')
        toast('settle', `${r.member.name} joined the team`, 'They already had a Veyra account, so they are in straight away.');
      else
        toast(
          'settle',
          `Invitation sent to ${r.invitation.email}`,
          'They join as soon as they open the link and create an account. The link works for 7 days.',
        );
      await invalidate();
    },
    onError: (err) => toast('fail', errorMessage(err)),
  });

  const update = useMutation({
    mutationFn: ({ m, patch }: { m: Member; patch: { role?: Role; walletAddress?: string | null } }) => api.members.update(org.orgId, m.id, patch),
    onSuccess: async () => {
      toast('settle', 'Saved');
      await invalidate();
    },
    onError: (err) => toast('fail', errorMessage(err)),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.invitations.revoke(org.orgId, id),
    onSuccess: async () => {
      toast('neutral', 'Invitation cancelled');
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
        description="Everyone who can see, prepare, approve or pay your payouts."
        actions={manage && <Button onClick={() => setAdding(true)}>Invite someone</Button>}
      />

      {onChain && self && !self.walletAddress && (
        <div className="mb-6">
          <Notice tone="pending" title="Link your approver wallet">
            The vault only accepts approvals from known wallets. Connect the wallet you approve with, then link it below.
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

      {!!invites.data?.length && (
        <Panel title="Waiting to join" className="mt-6" padded={false}>
          <ul className="divide-y divide-line">
            {invites.data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.email}</span>
                  <span className="block text-[13px] text-ink-faint">
                    Invited as {label(i.role).toLowerCase()} · link expires {new Date(i.expiresAt).toLocaleDateString()}
                  </span>
                </span>
                {manage && (
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={add.isPending && add.variables?.get('email') === i.email}
                      onClick={() => {
                        const f = new FormData();
                        f.set('email', i.email);
                        f.set('role', i.role);
                        if (i.walletAddress) f.set('wallet', i.walletAddress);
                        add.mutate(f);
                      }}
                    >
                      Resend
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)} loading={revoke.isPending && revoke.variables === i.id}>
                      Cancel
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
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

      <Dialog open={adding} onClose={() => setAdding(false)} title="Invite someone">
        <form onSubmit={onAdd} className="flex flex-col gap-4">
          <Field label="Their email" htmlFor="email" hint="We email them a link to join. If they already use Veyra, they join straight away.">
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
            <Field label="Approver wallet (optional)" htmlFor="wallet" hint="This wallet must also be set as an approver in your vault contract.">
              <Input id="wallet" name="wallet" mono placeholder="0x…" />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Close
            </Button>
            <Button type="submit" loading={add.isPending}>
              Send invitation
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
