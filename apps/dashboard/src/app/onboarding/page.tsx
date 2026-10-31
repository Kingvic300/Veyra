'use client';

import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, EyeOff, FlaskConical, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ExecutionMode } from '@veyra/core';
import { SkeletonShell } from '@/components/loading';
import { Logo } from '@/components/logo';
import { Avatar } from '@/components/org-avatar';
import { useNotify } from '@/components/providers';
import { Button, Field, Input, Notice } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { networkLabel } from '@/lib/format';
import { keys, useMe } from '@/lib/hooks';

const MODES: Record<ExecutionMode, { title: string; tagline: string; points: string[]; icon: typeof ShieldCheck }> = {
  vault: {
    title: 'Payroll vault',
    tagline: 'Transparent, contract-enforced',
    points: ['Funds sit in a PayrollVault contract', 'Pays only after approvers sign on-chain', 'Amounts and recipients are public'],
    icon: ShieldCheck,
  },
  'strk20-private': {
    title: 'Private transfers',
    tagline: 'STRK20, experimental',
    points: ['Pays from a shielded balance', 'Amounts and recipients stay hidden', 'Approvals enforced by Veyra'],
    icon: EyeOff,
  },
  simulated: {
    title: 'Sandbox',
    tagline: 'Simulated ledger',
    points: ['Fake funds, full flow', 'Try approvals and receipts safely', 'Nothing touches a blockchain'],
    icon: FlaskConical,
  },
};

const STEPS = ['Organisation', 'Network', 'Treasury', 'Approvals'] as const;
const STRK = { address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', symbol: 'STRK', decimals: 18 };

interface Draft {
  name: string;
  networkKey: string;
  mode: ExecutionMode;
  assetPreset: 'STRK' | 'custom';
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
  treasury: string;
  threshold: number;
  creatorApproves: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const notify = useNotify();
  const me = useMe();
  const networks = useQuery({ queryKey: keys.networks, queryFn: () => api.networks(), enabled: !!me.data });
  const orgs = useQuery({ queryKey: keys.orgs, queryFn: () => api.organisations.list(), enabled: !!me.data });
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({
    name: '',
    networkKey: '',
    mode: 'simulated',
    assetPreset: 'custom',
    assetAddress: '',
    assetSymbol: 'USDC',
    assetDecimals: 6,
    treasury: '',
    threshold: 2,
    creatorApproves: false,
  });
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);
  useEffect(() => {
    const first = networks.data?.[0];
    if (first && !d.networkKey) {
      set({ networkKey: `${first.chain}:${first.network}`, mode: first.executionModes[0]!, treasury: first.chain === 'simulated' ? 'sim:treasury' : '' });
    }
  }, [networks.data, d.networkKey]);

  const selected = useMemo(() => networks.data?.find((n) => `${n.chain}:${n.network}` === d.networkKey), [networks.data, d.networkKey]);
  const simulated = selected?.chain === 'simulated';
  const asset = simulated
    ? { address: 'sim:usdc', symbol: 'USDC', decimals: 6 }
    : d.assetPreset === 'STRK'
      ? STRK
      : { address: d.assetAddress.trim(), symbol: d.assetSymbol.trim(), decimals: d.assetDecimals };

  const create = useMutation({
    mutationFn: () =>
      api.organisations.create({
        name: d.name.trim(),
        chain: selected!.chain,
        network: selected!.network,
        executionMode: d.mode,
        treasuryAddress: d.treasury.trim() || null,
        asset,
        approvalPolicy: { threshold: d.threshold, allowCreatorApproval: d.creatorApproves, maxBatchTotal: null },
      }),
    onSuccess: async (org) => {
      await qc.invalidateQueries({ queryKey: keys.orgs });
      notify.toast({ tone: 'success', title: `${org.name} is ready`, description: 'Next, add your contractors and invite approvers.' });
      router.replace(`/o/${org.id}`);
    },
  });

  if (!me.data || networks.isLoading) return <SkeletonShell />;

  const canContinue = [
    d.name.trim().length > 0,
    !!selected,
    simulated || d.assetPreset === 'STRK' || (asset.address.length > 2 && asset.symbol.length > 0),
    d.threshold >= 1,
  ][step];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_480px]">
      <main className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo />
          {(orgs.data?.length ?? 0) > 0 && (
            <Link href="/app" className="text-sm text-ink-soft hover:text-ink">
              Back to your organisations
            </Link>
          )}
        </div>

        <ol className="mt-12 flex max-w-xl items-center gap-2" aria-label="Setup steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-2" aria-current={i === step ? 'step' : undefined}>
              <span className={clsx('h-1 rounded-full', i < step ? 'bg-settle' : i === step ? 'bg-ink' : 'bg-line')} />
              <span className={clsx('text-[12.5px]', i === step ? 'font-medium text-ink' : 'text-ink-faint')}>{label}</span>
            </li>
          ))}
        </ol>

        <form
          className="mt-10 flex max-w-xl flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canContinue) return;
            if (step < STEPS.length - 1) setStep(step + 1);
            else create.mutate();
          }}
        >
          {step === 0 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Name your organisation</h1>
              <p className="mt-2 text-ink-soft">This is the name approvers and contractors see on batches and receipts.</p>
              <div className="mt-8">
                <Field label="Organisation name" htmlFor="name">
                  <Input id="name" autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Lagos Dev Studio" maxLength={120} />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Where should payroll settle?</h1>
              <p className="mt-2 text-ink-soft">The network and mode decide who enforces approvals and what the public can see. You cannot change them later.</p>
              <div className="mt-8 flex flex-wrap gap-2">
                {networks.data?.map((n) => {
                  const key = `${n.chain}:${n.network}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set({ networkKey: key, mode: n.executionModes[0]!, treasury: n.chain === 'simulated' ? 'sim:treasury' : '' })}
                      className={clsx(
                        'flex items-center gap-2 rounded-full border px-4 py-2 text-sm',
                        d.networkKey === key ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <span className={clsx('size-1.5 rounded-full', n.chain === 'simulated' ? 'bg-pending' : 'bg-[#3fbf8f]')} />
                      {networkLabel(n.chain, n.network)}
                    </button>
                  );
                })}
              </div>
              {networks.data?.length === 0 && <Notice tone="fail">This server has no networks enabled. Ask your administrator to configure one.</Notice>}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {selected?.executionModes.map((m) => {
                  const mode = MODES[m];
                  const Icon = mode.icon;
                  const active = d.mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set({ mode: m })}
                      aria-pressed={active}
                      className={clsx(
                        'relative rounded-panel border bg-surface p-5 text-left transition-colors',
                        active ? 'border-settle shadow-[0_0_0_3px_var(--color-settle-wash)]' : 'border-line hover:border-line-strong',
                      )}
                    >
                      {active && (
                        <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-full bg-settle text-white">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                      <span className={clsx('flex size-10 items-center justify-center rounded-[10px]', active ? 'bg-settle-wash text-settle' : 'bg-wash text-ink-soft')}>
                        <Icon className="size-5" />
                      </span>
                      <span className="mt-4 block font-semibold">{mode.title}</span>
                      <span className="block text-[13px] text-ink-faint">{mode.tagline}</span>
                      <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-soft">
                        {mode.points.map((p) => (
                          <li key={p} className="flex gap-2">
                            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-faint" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Connect the treasury</h1>
              <p className="mt-2 text-ink-soft">
                {d.mode === 'vault'
                  ? 'Point Veyra at your deployed PayrollVault and the token you pay in. You can add the vault later from settings.'
                  : d.mode === 'strk20-private'
                    ? 'The privacy-enabled account that holds the shielded balance pays every batch.'
                    : 'The sandbox starts every treasury with one million test USDC.'}
              </p>
              <div className="mt-8 flex flex-col gap-5">
                {!simulated && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {(['custom', 'STRK'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => set({ assetPreset: p })}
                          className={clsx(
                            'rounded-control border px-4 py-3 text-left text-sm',
                            d.assetPreset === p ? 'border-settle bg-settle-wash/50' : 'border-line bg-surface hover:border-line-strong',
                          )}
                        >
                          <span className="block font-medium">{p === 'STRK' ? 'STRK' : 'Stablecoin'}</span>
                          <span className="block text-[12.5px] text-ink-faint">{p === 'STRK' ? 'Starknet token, 18 decimals' : 'For example USDC, enter its contract'}</span>
                        </button>
                      ))}
                    </div>
                    {d.assetPreset === 'custom' && (
                      <div className="grid gap-4 sm:grid-cols-[1fr_6rem_6rem]">
                        <Field label="Token contract" htmlFor="assetAddress" hint="Copy it from the issuer's official page.">
                          <Input id="assetAddress" mono value={d.assetAddress} onChange={(e) => set({ assetAddress: e.target.value })} placeholder="0x…" />
                        </Field>
                        <Field label="Symbol" htmlFor="assetSymbol">
                          <Input id="assetSymbol" value={d.assetSymbol} onChange={(e) => set({ assetSymbol: e.target.value })} />
                        </Field>
                        <Field label="Decimals" htmlFor="assetDecimals">
                          <Input id="assetDecimals" type="number" min={0} max={36} value={d.assetDecimals} onChange={(e) => set({ assetDecimals: Number(e.target.value) })} />
                        </Field>
                      </div>
                    )}
                  </>
                )}
                <Field
                  label={d.mode === 'vault' ? 'PayrollVault contract address' : d.mode === 'strk20-private' ? 'Paying account' : 'Treasury name'}
                  htmlFor="treasury"
                  hint={simulated ? 'Any name starting with sim: works.' : 'Optional now, required before your first batch.'}
                >
                  <Input id="treasury" mono value={d.treasury} onChange={(e) => set({ treasury: e.target.value })} placeholder={simulated ? 'sim:treasury' : '0x…'} />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Who has to agree before money moves?</h1>
              <p className="mt-2 text-ink-soft">
                Every batch needs this many approvals.{d.mode === 'vault' ? ' Keep it equal to the threshold set in your vault.' : ''}
              </p>
              <div className="mt-8">
                <p className="text-[13px] font-medium">Approvals per batch</p>
                <div className="mt-2 inline-flex rounded-control border border-line bg-surface p-1" role="radiogroup" aria-label="Approvals per batch">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={d.threshold === n}
                      onClick={() => set({ threshold: n })}
                      className={clsx('h-9 w-11 rounded-[6px] text-sm font-medium', d.threshold === n ? 'bg-ink text-white' : 'text-ink-soft hover:bg-wash')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label className="mt-6 flex max-w-md items-start gap-3 rounded-panel border border-line bg-surface p-4 text-sm">
                  <input type="checkbox" checked={d.creatorApproves} onChange={(e) => set({ creatorApproves: e.target.checked })} className="mt-0.5 accent-[var(--color-settle)]" />
                  <span>
                    Let the person who prepares a batch also approve it
                    <span className="block text-ink-faint">Leave off so preparing and approving stay with different people.</span>
                  </span>
                </label>
                {d.threshold === 1 && !d.creatorApproves && (
                  <p className="mt-4 text-[13px] text-pending">With one approval, one other person can release a whole payroll. Two is safer.</p>
                )}
              </div>
            </>
          )}

          {create.error && (
            <div className="mt-6">
              <Notice tone="fail">{errorMessage(create.error)}</Notice>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between pt-10">
            {step > 0 ? (
              <Button type="button" variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={!canContinue} loading={create.isPending}>
              {step < STEPS.length - 1 ? 'Continue' : 'Create organisation'}
            </Button>
          </div>
        </form>
      </main>

      {/* Live preview */}
      <aside className="block-grid hidden border-l border-line bg-[#f4f7f5] p-10 lg:flex lg:flex-col lg:justify-center" aria-label="Preview">
        <p className="text-[13px] text-ink-faint">Preview</p>
        <div className="mt-3 rounded-panel border border-line bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(19,32,27,0.45)]">
          <div className="flex items-center gap-3">
            <Avatar name={d.name || 'New organisation'} seed={d.name || 'x'} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{d.name || 'Your organisation'}</p>
              <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                <span className={clsx('size-1.5 rounded-full', simulated ? 'bg-pending' : 'bg-settle')} />
                {selected ? networkLabel(selected.chain, selected.network) : 'Choose a network'}
              </p>
            </div>
          </div>
          <dl className="mt-6 divide-y divide-line text-sm">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">Mode</dt>
              <dd className="font-medium">{MODES[d.mode].title}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">Pays in</dt>
              <dd className="font-medium">{asset.symbol || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">Treasury</dt>
              <dd className="max-w-[60%] truncate font-mono text-[12.5px]">{d.treasury || 'Not set'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">Approvals</dt>
              <dd className="flex items-center gap-1" aria-label={`${d.threshold} approvals`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={clsx('size-2.5 rounded-full', i < d.threshold ? 'bg-settle' : 'bg-line')} />
                ))}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">Amounts on-chain</dt>
              <dd className="font-medium">{d.mode === 'strk20-private' ? 'Hidden' : d.mode === 'vault' ? 'Public' : 'Not published'}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-5 max-w-sm text-[13px] text-ink-soft">
          You become the owner. Contractor names and amounts are encrypted in Veyra before anything is stored.
        </p>
      </aside>
    </div>
  );
}
