'use client';

import clsx from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FileClock, LayoutGrid, LogOut, Menu, Settings, UserRound, Users, UserSquare2, Wallet2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { needsAttention } from '@/lib/attention';
import { amount } from '@/lib/format';
import { keys, useMe, useOrg, useTreasury } from '@/lib/hooks';
import { SkeletonShell } from './loading';
import { Logo } from './logo';
import { NotificationBell } from './notification-bell';
import { Avatar } from './org-avatar';
import { OrgSwitcher } from './org-switcher';
import { PopoverPanel, usePopover } from './popover';
import { WalletButton } from './wallet-button';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
  badge?: number;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const org = useOrg();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);
  useEffect(() => setMenuOpen(false), [pathname]);

  if (me.isLoading || org.isLoading) return <SkeletonShell />;
  if (org.isError || !org.data) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24">
        <h1 className="text-2xl font-semibold">Company not found</h1>
        <p className="mt-2 text-ink-soft">It does not exist or you are not a member.</p>
        <Link href="/app" className="mt-6 inline-block font-medium text-settle">
          Go to your companies
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="no-print sticky top-0 hidden h-dvh border-r border-line bg-[#f4f7f5] lg:block">
        <Sidebar />
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[288px] bg-[#f4f7f5] shadow-xl">
            <button type="button" className="absolute right-3 top-4 p-1" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X className="size-5" />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="w-full flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const org = useOrg();
  const batches = useQuery({ queryKey: keys.batches(org.orgId), queryFn: () => api.batches.list(org.orgId) });
  const base = `/o/${org.orgId}`;
  const waiting = needsAttention(batches.data ?? [], org.can).length;

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Pay',
      items: [
        { href: base, label: 'Overview', icon: LayoutGrid, exact: true },
        { href: `${base}/batches`, label: 'Payouts', icon: Wallet2, badge: waiting },
        ...(org.can('contractors:read') ? [{ href: `${base}/contractors`, label: 'People', icon: UserSquare2 }] : []),
      ],
    },
    {
      title: 'Company',
      items: [
        { href: `${base}/team`, label: 'Team', icon: Users },
        { href: `${base}/audit`, label: 'History', icon: FileClock },
        ...(org.can('org:manage') ? [{ href: `${base}/settings`, label: 'Settings', icon: Settings }] : []),
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-4 pt-5">
      <Link href={base} className="px-1.5">
        <Logo />
      </Link>
      <div className="mt-6">
        <OrgSwitcher />
      </div>

      <nav className="mt-7 flex flex-col gap-6" aria-label="Main">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 text-[12px] font-medium text-ink-faint">{g.title}</p>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {g.items.map(({ href, label, icon: Icon, exact, badge }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'group relative flex items-center gap-3 rounded-control px-3 py-2 text-[14.5px] transition-colors',
                        active
                          ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(19,32,27,0.06),inset_0_0_0_1px_var(--color-line)]'
                          : 'text-ink-soft hover:bg-surface/70 hover:text-ink',
                      )}
                    >
                      {active && <span className="absolute -left-4 bottom-1.5 top-1.5 w-[3px] rounded-r-full bg-settle" aria-hidden />}
                      <Icon className={clsx('size-[17px]', active ? 'text-settle' : 'text-ink-faint group-hover:text-ink-soft')} aria-hidden />
                      <span className="flex-1">{label}</span>
                      {!!badge && <span className="rounded-full bg-pending-wash px-1.5 text-[11.5px] font-semibold text-pending">{badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <TreasuryCard />
        <UserCard />
      </div>
    </div>
  );
}

/** Compact ledger of the treasury, always in view. */
function TreasuryCard() {
  const org = useOrg();
  const t = useTreasury();
  const o = org.data!;
  return (
    <Link href={`/o/${o.id}`} className="block rounded-[12px] border border-line bg-surface p-3.5 hover:border-line-strong">
      <span className="flex items-center justify-between text-[12px] text-ink-faint">
        Funds
        <span className="flex items-center gap-1">
          <span className={clsx('size-1.5 rounded-full', t.data?.error ? 'bg-pending' : 'dot-live bg-settle')} aria-hidden />
          {t.data?.error ? 'Unavailable' : 'Live'}
        </span>
      </span>
      {t.isLoading ? (
        <span className="skeleton mt-2 block h-5 w-32 rounded-md" />
      ) : (
        <span className="mt-1.5 block text-[17px] font-semibold tracking-[-0.01em]">{t.data?.balance ? amount(t.data.balance, o.asset) : '—'}</span>
      )}
      {t.data?.available && t.data.committed !== '0' && (
        <span className="mt-0.5 block text-[12px] text-ink-soft">{amount(t.data.available, o.asset)} free to pay</span>
      )}
    </Link>
  );
}

function UserCard() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const org = useOrg();
  const { open, setOpen, ref } = usePopover();
  if (!me.data) return null;
  const role = org.data!.role;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left hover:bg-surface"
      >
        <Avatar name={me.data.name} seed={me.data.id} round />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{me.data.name}</span>
          <span className="block truncate text-[12px] text-ink-faint">{role.charAt(0) + role.slice(1).toLowerCase()}</span>
        </span>
      </button>
      {open && (
        <PopoverPanel className="bottom-[calc(100%+6px)] left-0 right-0">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-medium">{me.data.name}</p>
            <p className="truncate text-[12.5px] text-ink-faint">{me.data.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(`/o/${org.data!.id}/profile`);
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-ink-soft hover:bg-wash hover:text-ink"
          >
            <UserRound className="size-4" /> Your profile
          </button>
          <button
            type="button"
            onClick={async () => {
              await api.auth.logout();
              sessionStorage.removeItem('veyra:signed-in');
              qc.clear();
              router.replace('/login');
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-ink-soft hover:bg-wash hover:text-ink"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </PopoverPanel>
      )}
    </div>
  );
}

const SEGMENT_LABEL: Record<string, string> = {
  batches: 'Payouts',
  contractors: 'People',
  team: 'Team',
  audit: 'History',
  settings: 'Settings',
  new: 'New payout',
  receipt: 'Receipt',
  profile: 'Your profile',
};

function TopBar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const params = useParams<{ batchId?: string }>();
  const org = useOrg();
  const me = useMe();
  const o = org.data!;
  const members = useQuery({ queryKey: keys.members(o.id), queryFn: () => api.members.list(o.id) });
  const batch = useQuery({
    queryKey: keys.batch(o.id, params.batchId ?? ''),
    queryFn: () => api.batches.get(o.id, params.batchId!),
    enabled: !!params.batchId,
  });
  const self = members.data?.find((m) => m.userId === me.data?.id);

  const rest = pathname.replace(`/o/${o.id}`, '').split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: 'Overview', href: `/o/${o.id}` }];
  let href = `/o/${o.id}`;
  for (const seg of rest) {
    href += `/${seg}`;
    crumbs.push({ label: seg === params.batchId ? (batch.data?.title ?? 'Batch') : (SEGMENT_LABEL[seg] ?? seg), href });
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper/85 px-5 backdrop-blur sm:px-8 lg:px-10">
      <button type="button" onClick={onMenu} className="-ml-1 p-1 lg:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <li key={c.href} className={clsx('flex min-w-0 items-center gap-1.5', i < crumbs.length - 1 && 'hidden sm:flex')}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden />}
              {i === crumbs.length - 1 ? (
                <span className="truncate font-medium text-ink" aria-current="page">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="truncate text-ink-soft hover:text-ink">
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <span className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-soft md:flex">
        <span className={clsx('size-1.5 rounded-full', o.chain === 'simulated' ? 'bg-pending' : 'dot-live bg-settle')} aria-hidden />
        {o.chain === 'simulated'
          ? 'Practice · fake money'
          : o.network === 'mainnet'
            ? 'Real money'
            : `${o.network.charAt(0).toUpperCase()}${o.network.slice(1)} · test tokens`}
      </span>
      {o.chain !== 'simulated' && <WalletButton expected={self?.walletAddress} />}
      <NotificationBell />
    </header>
  );
}
