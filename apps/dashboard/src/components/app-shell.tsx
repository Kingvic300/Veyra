'use client';

import clsx from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileClock, Home, LogOut, Menu, Settings, Users, UserSquare2, Wallet2, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { networkLabel } from '@/lib/format';
import { keys, useMe, useOrg } from '@/lib/hooks';
import { Logo } from './logo';
import { SkeletonShell } from './loading';
import { NotificationBell } from './notification-bell';
import { WalletButton } from './wallet-button';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const me = useMe();
  const org = useOrg();
  const orgs = useQuery({ queryKey: keys.orgs, queryFn: () => api.organisations.list(), enabled: !!me.data });
  const members = useQuery({
    queryKey: keys.members(org.orgId),
    queryFn: () => api.members.list(org.orgId),
    enabled: !!org.data,
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);
  useEffect(() => setMenuOpen(false), [pathname]);

  if (me.isLoading || org.isLoading) return <SkeletonShell />;
  if (org.isError || !org.data) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24">
        <h1 className="text-2xl font-semibold">Organisation not found</h1>
        <p className="mt-2 text-ink-soft">It does not exist or you are not a member.</p>
        <Link href="/app" className="mt-6 inline-block font-medium text-settle">
          Go to your organisations
        </Link>
      </main>
    );
  }

  const base = `/o/${org.orgId}`;
  const nav = [
    { href: base, label: 'Overview', icon: Home, exact: true },
    { href: `${base}/batches`, label: 'Payroll', icon: Wallet2 },
    ...(org.can('contractors:read') ? [{ href: `${base}/contractors`, label: 'Contractors', icon: UserSquare2 }] : []),
    { href: `${base}/team`, label: 'Team', icon: Users },
    { href: `${base}/audit`, label: 'Audit log', icon: FileClock },
    ...(org.can('org:manage') ? [{ href: `${base}/settings`, label: 'Settings', icon: Settings }] : []),
  ];
  const self = members.data?.find((m) => m.userId === me.data?.id);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="flex items-center justify-between">
        <Link href={base}>
          <Logo />
        </Link>
        <div className="hidden lg:block">
          <NotificationBell />
        </div>
        <button type="button" className="lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>

      <div>
        <label htmlFor="org-switch" className="sr-only">
          Organisation
        </label>
        <select
          id="org-switch"
          value={org.orgId}
          onChange={(e) => (e.target.value === '__new' ? router.push('/onboarding') : router.push(`/o/${e.target.value}`))}
          className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-medium"
        >
          {orgs.data?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="__new">New organisation…</option>
        </select>
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[12.5px] text-ink-faint">
          <span className={clsx('size-1.5 rounded-full', org.data.chain === 'simulated' ? 'bg-pending' : 'bg-settle')} />
          {networkLabel(org.data.chain, org.data.network)}
        </p>
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-control px-3 py-2 text-[14.5px]',
                active ? 'bg-ink text-white' : 'text-ink-soft hover:bg-wash hover:text-ink',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {org.data.chain !== 'simulated' && <WalletButton expected={self?.walletAddress} />}
        <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{me.data?.name}</span>
            <span className="block text-[12.5px] text-ink-faint">{org.data.role.charAt(0) + org.data.role.slice(1).toLowerCase()}</span>
          </span>
          <button
            type="button"
            onClick={async () => {
              await api.auth.logout();
              qc.clear();
              router.replace('/login');
            }}
            className="rounded-control p-2 text-ink-faint hover:bg-wash hover:text-ink"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-surface">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="no-print flex items-center justify-between border-b border-line bg-surface px-5 py-3 lg:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2">
              <Menu className="size-5" />
            </button>
          </div>
        </header>
        <main className="w-full px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
