'use client';

import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, EyeOff, FlaskConical, ShieldCheck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ExecutionMode } from '@veyra/core';
import { SkeletonShell } from '@/components/loading';
import { Logo } from '@/components/logo';
import { Avatar } from '@/components/org-avatar';
import { useNotify } from '@/components/providers';
import { Button, Field, Input, Notice, PrefixInput } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { networkLabel } from '@/lib/format';
import { keys, useMe } from '@/lib/hooks';

interface ModeCopy {
  title: string;
  tagline: string;
  /** Plain answers to the questions people ask before choosing. */
  facts: { label: string; value: string }[];
  icon: typeof ShieldCheck;
}

const MODES: Record<ExecutionMode, ModeCopy> = {
  wallet: {
    title: 'Pay from your wallet',
    tagline: 'Payments go straight from your own Starknet wallet. Nothing to deploy.',
    facts: [
      { label: 'Money', value: 'Stays in your own wallet until you pay' },
      { label: 'Approvals checked by', value: 'Veyra, before your wallet is asked to pay' },
      { label: 'Salaries visible to', value: 'Anyone, on the public blockchain' },
      { label: 'You need', value: 'A Starknet wallet with funds' },
    ],
    icon: Wallet,
  },
  simulated: {
    title: 'Practice mode',
    tagline: 'Try the whole payroll flow with fake money. Nothing touches a blockchain.',
    facts: [
      { label: 'Money', value: '1,000,000 test USDC, created for you' },
      { label: 'Approvals checked by', value: 'Veyra' },
      { label: 'Salaries visible to', value: 'Only your team' },
      { label: 'You need', value: 'Nothing' },
    ],
    icon: FlaskConical,
  },
  vault: {
    title: 'Payroll vault',
    tagline: 'A smart contract holds the money and pays only when enough people approve.',
    facts: [
      { label: 'Money', value: 'In your PayrollVault contract' },
      { label: 'Approvals checked by', value: 'The contract. Not even Veyra can skip them.' },
      { label: 'Salaries visible to', value: 'Anyone, on the public blockchain' },
      { label: 'You need', value: 'A Starknet wallet and a deployed vault' },
    ],
    icon: ShieldCheck,
  },
  'strk20-private': {
    title: 'Private payments',
    tagline: 'Pay from a hidden balance so amounts and recipients stay private. Experimental.',
    facts: [
      { label: 'Money', value: 'A shielded balance in your account' },
      { label: 'Approvals checked by', value: 'Veyra, before each payment' },
      { label: 'Salaries visible to', value: 'Only your team' },
      { label: 'You need', value: 'A privacy-enabled Starknet account' },
    ],
    icon: EyeOff,
  },
};

/** Short tag saying what kind of network an option runs on. */
function networkBadge(chain: string, network: string): { label: string; className: string } {
  if (chain === 'simulated') return { label: 'No blockchain', className: 'bg-pending-wash text-pending' };
  if (network === 'mainnet') return { label: 'Starknet · real money', className: 'bg-fail-wash text-fail' };
  return { label: `Starknet ${network.charAt(0).toUpperCase()}${network.slice(1)} · test tokens`, className: 'bg-settle-wash text-settle-strong' };
}

/** Practice mode should be finishable alone; real money starts with a second pair of eyes. */
function approvalDefaults(chain: string): { threshold: number; creatorApproves: boolean } {
  return chain === 'simulated' ? { threshold: 1, creatorApproves: true } : { threshold: 2, creatorApproves: false };
}

function networkName(chain: string, network: string): string {
  return chain === 'simulated' ? 'Practice (no blockchain)' : networkLabel(chain, network);
}

const STEPS = ['Name', 'How you pay', 'Money', 'Approvals'] as const;
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

  // Going live from a practice company: /onboarding?from=<practiceOrgId>
  const [fromId, setFromId] = useState<string | null>(null);
  useEffect(() => {
    setFromId(new URLSearchParams(window.location.search).get('from'));
  }, []);
  const source = useQuery({ queryKey: keys.org(fromId ?? ''), queryFn: () => api.organisations.get(fromId!), enabled: !!fromId });
  useEffect(() => {
    if (source.data && !d.name) set({ name: source.data.name });
  }, [source.data, d.name]);
  const options = useMemo(() => (fromId ? networks.data?.filter((n) => n.chain !== 'simulated') : networks.data), [networks.data, fromId]);

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);
  useEffect(() => {
    const first = options?.[0];
    if (first && (!d.networkKey || (fromId && d.networkKey.startsWith('simulated')))) {
      set({ networkKey: `${first.chain}:${first.network}`, mode: first.executionModes[0]!, treasury: first.chain === 'simulated' ? 'sim:treasury' : '', ...approvalDefaults(first.chain) });
    }
  }, [options, d.networkKey, fromId]);

  const selected = useMemo(() => networks.data?.find((n) => `${n.chain}:${n.network}` === d.networkKey), [networks.data, d.networkKey]);
  const simulated = selected?.chain === 'simulated';
  const asset = simulated
    ? { address: 'sim:usdc', symbol: 'USDC', decimals: 6 }
    : d.assetPreset === 'STRK'
      ? STRK
      : { address: d.assetAddress.trim(), symbol: d.assetSymbol.trim(), decimals: d.assetDecimals };

  const create = useMutation({
    mutationFn: async () => {
      const input = {
        name: d.name.trim(),
        chain: selected!.chain,
        network: selected!.network,
        executionMode: d.mode,
        treasuryAddress: d.treasury.trim() || null,
        asset,
        approvalPolicy: { threshold: d.threshold, allowCreatorApproval: d.creatorApproves, maxBatchTotal: null },
      };
      if (!fromId) return { org: await api.organisations.create(input), needWallets: [] as { name: string; email: string | null; country: string | null }[] };
      const r = await api.goLive(fromId, input);
      return { org: r.organisation, needWallets: r.peopleNeedingWallets };
    },
    onSuccess: async ({ org, needWallets }) => {
      await qc.invalidateQueries({ queryKey: keys.orgs });
      if (needWallets.length) {
        try {
          sessionStorage.setItem(`veyra:needs-wallet:${org.id}`, JSON.stringify(needWallets));
        } catch {
          /* storage unavailable: the People page simply shows no reminder */
        }
      }
      notify.toast({
        tone: 'success',
        title: fromId ? `${org.name} is live` : `${org.name} is ready`,
        description: fromId
          ? needWallets.length
            ? `Your team came across. Add real wallets for ${needWallets.length} ${needWallets.length === 1 ? 'person' : 'people'} next.`
            : 'Your team and people came across.'
          : 'Next, add the people you pay.',
      });
      router.replace(fromId && needWallets.length ? `/o/${org.id}/contractors` : `/o/${org.id}`);
    },
    onError: (err) => notify.toast({ tone: 'error', title: errorMessage(err) }),
  });

  if (!me.data || networks.isLoading) return <SkeletonShell />;

  const canContinue = [
    d.name.trim().length > 0,
    !!selected,
    simulated || d.assetPreset === 'STRK' || (asset.address.length > 2 && asset.symbol.length > 0),
    d.threshold >= 1,
  ][step];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_480px]">
      <main className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo />
          {(orgs.data?.length ?? 0) > 0 && (
            <Link href="/app" className="text-sm text-ink-soft hover:text-ink">
              Back to your companies
            </Link>
          )}
        </div>

        <ol className="mt-12 flex max-w-3xl items-center gap-2" aria-label="Setup steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-2" aria-current={i === step ? 'step' : undefined}>
              <span className={clsx('h-1 rounded-full', i < step ? 'bg-settle' : i === step ? 'bg-ink' : 'bg-line')} />
              <span className={clsx('text-[12.5px]', i === step ? 'font-medium text-ink' : 'text-ink-faint')}>{label}</span>
            </li>
          ))}
        </ol>

        <form
          className="mt-10 flex max-w-3xl flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canContinue) return;
            if (step < STEPS.length - 1) setStep(step + 1);
            else create.mutate();
          }}
        >
          {step === 0 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">{fromId ? 'Go live with real money' : 'Name your company'}</h1>
              <p className="mt-2 max-w-[60ch] text-ink-soft">
                {fromId
                  ? 'This creates a new company that pays with real money and copies your team, approval rules and people across. Your practice company stays as it is.'
                  : 'Your team and the people you pay see this name on payouts and receipts.'}
              </p>
              <div className="mt-8">
                <Field label="Company name" htmlFor="name">
                  <Input id="name" autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Lagos Dev Studio" maxLength={120} />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">How do you want to pay?</h1>
              <p className="mt-2 max-w-[60ch] text-ink-soft">
                This decides where the money sits, who checks approvals and who can see salaries. You cannot change it later, so start with
                practice mode if you are unsure.
              </p>
              {networks.data?.length === 0 && (
                <div className="mt-8">
                  <Notice tone="fail">This server has no payment options turned on. Ask your administrator to set one up.</Notice>
                </div>
              )}
              <div role="radiogroup" aria-label="Payment option" className="mt-8 grid gap-4 md:grid-cols-2">
                {options?.flatMap((n) =>
                  n.executionModes.map((m) => {
                    const key = `${n.chain}:${n.network}`;
                    const mode = MODES[m];
                    const Icon = mode.icon;
                    const active = d.networkKey === key && d.mode === m;
                    const badge = networkBadge(n.chain, n.network);
                    return (
                      <button
                        key={`${key}:${m}`}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() =>
                          set(
                            d.networkKey === key
                              ? { mode: m }
                              : { networkKey: key, mode: m, treasury: n.chain === 'simulated' ? 'sim:treasury' : '', ...approvalDefaults(n.chain) },
                          )
                        }
                        className={clsx(
                          'flex flex-col rounded-panel border bg-surface p-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-settle focus-visible:ring-offset-2',
                          active ? 'border-settle shadow-[0_0_0_3px_var(--color-settle-wash)]' : 'border-line hover:border-line-strong',
                        )}
                      >
                        <span className="flex items-start justify-between">
                          <span
                            className={clsx(
                              'flex size-10 items-center justify-center rounded-[10px]',
                              active ? 'bg-settle-wash text-settle' : 'bg-wash text-ink-soft',
                            )}
                          >
                            <Icon className="size-5" />
                          </span>
                          <span
                            aria-hidden
                            className={clsx(
                              'flex size-5 items-center justify-center rounded-full border-2',
                              active ? 'border-settle bg-settle text-white' : 'border-line-strong',
                            )}
                          >
                            {active && <Check className="size-3" strokeWidth={3} />}
                          </span>
                        </span>
                        <span className="mt-4 text-[17px] font-semibold">{mode.title}</span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <span className={clsx('rounded-full px-2 py-0.5 text-[11.5px] font-medium', badge.className)}>{badge.label}</span>
                          {m === 'simulated' && (
                            <span className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-ink-soft">Recommended to start</span>
                          )}
                        </span>
                        <span className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-soft">{mode.tagline}</span>
                        <dl className="mt-6 flex flex-col gap-4 border-t border-line pt-6 text-[13px]">
                          {mode.facts.map((f) => (
                            <div key={f.label}>
                              <dt className="text-ink-faint">{f.label}</dt>
                              <dd className="mt-0.5 text-ink">{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </button>
                    );
                  }),
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">{simulated ? 'Your practice money' : 'Where the money comes from'}</h1>
              <p className="mt-2 text-ink-soft">
                {d.mode === 'wallet'
                  ? 'Choose the token you pay in and paste your Starknet wallet address. Only this wallet can pay.'
                  : d.mode === 'vault'
                  ? 'Choose the token you pay in and paste the address of your PayrollVault contract. You can add the vault later in settings.'
                  : d.mode === 'strk20-private'
                    ? 'Every payout comes from the hidden balance in this Starknet account.'
                    : 'Veyra gives you 1,000,000 test USDC to practise with. It has no real value.'}
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
                          <span className="block text-[12.5px] text-ink-faint">{p === 'STRK' ? 'Starknet\'s own token' : 'For example USDC. Paste its contract address.'}</span>
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
                  label={d.mode === 'wallet' ? 'Your wallet address' : d.mode === 'vault' ? 'PayrollVault contract address' : d.mode === 'strk20-private' ? 'Paying account address' : 'Account name'}
                  htmlFor="treasury"
                  hint={simulated ? 'Any name works. You can keep the default.' : 'You can skip this now. You need it before your first payout.'}
                >
                  {simulated ? (
                    <PrefixInput id="treasury" prefix="sim:" lowercase value={d.treasury} onValueChange={(treasury) => set({ treasury })} placeholder="treasury" />
                  ) : (
                    <Input id="treasury" mono value={d.treasury} onChange={(e) => set({ treasury: e.target.value })} placeholder="0x…" />
                  )}
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Who must approve each payroll?</h1>
              <p className="mt-2 max-w-[60ch] text-ink-soft">
                No payout can be paid until enough people on your team have checked it and pressed Approve. Owners, admins and approvers can approve.
              </p>

              <fieldset className="mt-8">
                <legend className="text-[13px] font-medium">How many approvals does a payout need?</legend>
                <div className="mt-2 inline-flex rounded-control border border-line bg-surface p-1" role="radiogroup" aria-label="Approvals needed">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={d.threshold === n}
                      aria-label={`${n} ${n === 1 ? 'approval' : 'approvals'}`}
                      onClick={() => set({ threshold: n })}
                      className={clsx(
                        'h-10 w-11 rounded-[6px] text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-settle',
                        d.threshold === n ? 'bg-ink text-white' : 'text-ink-soft hover:bg-wash',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {d.mode === 'vault' && (
                  <p className="mt-2 text-[13px] text-ink-faint">Use the same number you set as the approval threshold in your PayrollVault contract.</p>
                )}
              </fieldset>

              <label className="mt-6 flex max-w-xl cursor-pointer items-start gap-3 rounded-panel border border-line bg-surface p-4 text-sm">
                <input
                  type="checkbox"
                  checked={d.creatorApproves}
                  onChange={(e) => set({ creatorApproves: e.target.checked })}
                  className="mt-0.5 size-4 accent-[var(--color-settle)]"
                />
                <span>
                  <span className="font-medium">The person who creates a payout can also approve it</span>
                  <span className="mt-1 block text-ink-soft">
                    Leave this off for real money. Then someone other than the creator always checks the payout, so nobody can pay themselves or a made-up
                    contractor alone.
                  </span>
                </span>
              </label>

              <div
                className={clsx(
                  'mt-6 max-w-xl rounded-panel border p-4 text-sm',
                  d.threshold === 1 && d.creatorApproves ? 'border-pending/40 bg-pending-wash' : 'border-line bg-wash',
                )}
                aria-live="polite"
              >
                <p className="font-medium">What this means</p>
                <p className="mt-1 text-ink-soft">
                  {d.creatorApproves
                    ? d.threshold === 1
                      ? 'One person can create a payout and approve it alone. That is fine for practice, but risky for real money.'
                      : `A payout is paid once ${d.threshold} people approve it. The person who created it can be one of them.`
                    : `One person creates a payout, then ${d.threshold === 1 ? 'one other person approves it' : `${d.threshold} other people approve it`}.`}
                </p>
                <p className="mt-2 text-ink-soft">
                  {(() => {
                    const others = d.creatorApproves ? d.threshold - 1 : d.threshold;
                    return others === 0
                      ? 'You can pay on your own right away.'
                      : `You are the only member so far. Invite at least ${others} ${others === 1 ? 'approver' : 'approvers'} on the Team page before your first payout can be paid.`;
                  })()}
                </p>
              </div>
            </>
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
              {step < STEPS.length - 1 ? 'Continue' : fromId ? 'Go live' : 'Create company'}
            </Button>
          </div>
        </form>
      </main>

      {/* Live preview */}
      <aside
        className="block-grid hidden border-l border-line bg-[#f4f7f5] p-10 lg:flex lg:flex-col lg:justify-center"
        aria-label="Preview"
      >
        <p className="text-[13px] text-ink-faint">Preview</p>
        <div className="mt-3 rounded-panel border border-line bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(19,32,27,0.45)]">
          <div className="flex items-center gap-3">
            <Avatar name={d.name || 'New company'} seed={d.name || 'x'} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{d.name || 'Your company'}</p>
              <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                <span className={clsx('size-1.5 rounded-full', simulated ? 'bg-pending' : 'bg-settle')} />
                {selected ? networkName(selected.chain, selected.network) : 'Choose a network'}
              </p>
            </div>
          </div>
          <dl className="mt-6 divide-y divide-line text-sm">
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">How you pay</dt>
              <dd className="font-medium">{MODES[d.mode].title}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">Pays in</dt>
              <dd className="font-medium">{asset.symbol || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-soft">Paid from</dt>
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
              <dt className="text-ink-soft">Salaries visible to</dt>
              <dd className="font-medium">{d.mode === 'vault' ? 'Anyone' : 'Your team only'}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-5 max-w-sm text-[13px] text-ink-soft">
          You become the owner. Names and amounts are encrypted in Veyra before anything is stored.
        </p>
      </aside>
    </div>
  );
}
