'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ExecutionMode } from '@veyra/core';
import { Logo } from '@/components/logo';
import { Button, Field, Input, Notice, Select, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { networkLabel } from '@/lib/format';
import { keys, useMe } from '@/lib/hooks';

const MODE_COPY: Record<ExecutionMode, { title: string; body: string }> = {
  vault: {
    title: 'Payroll vault (transparent)',
    body: 'Funds sit in a PayrollVault contract. It only pays out after enough approvers sign on-chain. Amounts and recipients are public.',
  },
  'strk20-private': {
    title: 'STRK20 private transfers (experimental)',
    body: 'Your privacy wallet pays from a shielded balance. Amounts and recipients stay hidden; approvals are enforced by Veyra, not a contract.',
  },
  simulated: {
    title: 'Simulated ledger',
    body: 'Try the full flow with fake funds. Nothing touches a real network.',
  },
};

const STRK = { address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', symbol: 'STRK', decimals: 18 };

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const networks = useQuery({ queryKey: keys.networks, queryFn: () => api.networks(), enabled: !!me.data });
  const [networkKey, setNetworkKey] = useState('');
  const [mode, setMode] = useState<ExecutionMode>('simulated');
  const [assetPreset, setAssetPreset] = useState<'STRK' | 'custom'>('custom');

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  useEffect(() => {
    const first = networks.data?.[0];
    if (first && !networkKey) {
      setNetworkKey(`${first.chain}:${first.network}`);
      setMode(first.executionModes[0]!);
    }
  }, [networks.data, networkKey]);

  const selected = useMemo(() => networks.data?.find((n) => `${n.chain}:${n.network}` === networkKey), [networks.data, networkKey]);
  const simulated = selected?.chain === 'simulated';

  const create = useMutation({
    mutationFn: (form: FormData) => {
      const asset = simulated
        ? { address: 'sim:usdc', symbol: 'USDC', decimals: 6 }
        : assetPreset === 'STRK'
          ? STRK
          : { address: String(form.get('assetAddress')), symbol: String(form.get('assetSymbol')), decimals: Number(form.get('assetDecimals')) };
      return api.organisations.create({
        name: String(form.get('name')),
        chain: selected!.chain,
        network: selected!.network,
        executionMode: mode,
        treasuryAddress: String(form.get('treasury') || '') || null,
        asset,
        approvalPolicy: { threshold: Number(form.get('threshold')), allowCreatorApproval: form.get('creatorApproves') === 'on', maxBatchTotal: null },
      });
    },
    onSuccess: async (org) => {
      await qc.invalidateQueries({ queryKey: keys.orgs });
      router.replace(`/o/${org.id}`);
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    create.mutate(new FormData(e.currentTarget));
  }

  if (!me.data || networks.isLoading) return <Spinner />;

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Logo />
      <h1 className="mt-12 text-[30px] font-semibold">Set up your organisation</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">
        Pick where payroll settles and who has to agree before money moves. You can add teammates and contractors next.
      </p>

      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-8">
        <Field label="Organisation name" htmlFor="name">
          <Input id="name" name="name" required placeholder="Lagos Dev Studio" />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-[13px] font-medium">Settlement network</legend>
          {networks.data?.length === 0 && <Notice tone="fail">This server has no networks enabled. Ask your administrator to configure one.</Notice>}
          <Select
            value={networkKey}
            onChange={(e) => {
              setNetworkKey(e.target.value);
              const n = networks.data?.find((x) => `${x.chain}:${x.network}` === e.target.value);
              if (n) setMode(n.executionModes[0]!);
            }}
            aria-label="Settlement network"
          >
            {networks.data?.map((n) => (
              <option key={`${n.chain}:${n.network}`} value={`${n.chain}:${n.network}`}>
                {networkLabel(n.chain, n.network)}
              </option>
            ))}
          </Select>
          <div className="grid gap-3">
            {selected?.executionModes.map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer gap-3 rounded-panel border p-4 transition-colors ${mode === m ? 'border-settle bg-settle-wash/50' : 'border-line bg-surface hover:border-line-strong'}`}
              >
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1 accent-[var(--color-settle)]" />
                <span>
                  <span className="block font-medium">{MODE_COPY[m].title}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{MODE_COPY[m].body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {!simulated && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-[13px] font-medium">Payroll asset</legend>
            <Select value={assetPreset} onChange={(e) => setAssetPreset(e.target.value as 'STRK' | 'custom')} aria-label="Payroll asset">
              <option value="custom">Stablecoin (enter the token contract)</option>
              <option value="STRK">STRK</option>
            </Select>
            {assetPreset === 'custom' && (
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem_6rem]">
                <Field label="Token contract" htmlFor="assetAddress" hint="Copy it from the issuer's official page, for example Circle for USDC.">
                  <Input id="assetAddress" name="assetAddress" mono required placeholder="0x…" />
                </Field>
                <Field label="Symbol" htmlFor="assetSymbol">
                  <Input id="assetSymbol" name="assetSymbol" required defaultValue="USDC" />
                </Field>
                <Field label="Decimals" htmlFor="assetDecimals">
                  <Input id="assetDecimals" name="assetDecimals" type="number" min={0} max={36} required defaultValue={6} />
                </Field>
              </div>
            )}
          </fieldset>
        )}

        <Field
          label={mode === 'vault' ? 'PayrollVault contract address' : mode === 'strk20-private' ? 'Paying account address' : 'Treasury account'}
          htmlFor="treasury"
          hint={
            mode === 'vault'
              ? 'Deploy the vault with your approvers first (see the deployment guide). You can add it later in settings.'
              : simulated
                ? 'Any name starting with sim: works on the simulated ledger.'
                : 'The privacy-enabled wallet that holds the shielded balance.'
          }
        >
          <Input id="treasury" name="treasury" mono defaultValue={simulated ? 'sim:treasury' : ''} placeholder="0x…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Approvals needed per batch" htmlFor="threshold" hint={mode === 'vault' ? 'Must match the vault threshold.' : undefined}>
            <Input id="threshold" name="threshold" type="number" min={1} max={20} defaultValue={2} required />
          </Field>
          <label className="flex items-start gap-3 self-end rounded-control border border-line p-3 text-sm">
            <input type="checkbox" name="creatorApproves" className="mt-0.5 accent-[var(--color-settle)]" />
            <span>
              Let the person who creates a batch also approve it
              <span className="block text-ink-faint">Off keeps preparing and approving separate.</span>
            </span>
          </label>
        </div>

        {create.error && <Notice tone="fail">{errorMessage(create.error)}</Notice>}
        <div>
          <Button type="submit" loading={create.isPending} disabled={!selected}>
            Create organisation
          </Button>
        </div>
      </form>
    </main>
  );
}
