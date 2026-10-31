'use client';

import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { keys, useOrg } from '@/lib/hooks';
import { Avatar } from './org-avatar';
import { PopoverPanel, usePopover } from './popover';

const MODE_LABEL = { wallet: 'Pay from wallet', vault: 'Payroll vault', 'strk20-private': 'Private payments', simulated: 'Practice mode' } as const;

/** One short line: how the organisation pays, plus the network when it is a real one. */
function orgSummary(o: { chain: string; network: string; executionMode: keyof typeof MODE_LABEL }): string {
  if (o.chain === 'simulated') return MODE_LABEL.simulated;
  return `${MODE_LABEL[o.executionMode]} · ${o.network.charAt(0).toUpperCase()}${o.network.slice(1)}`;
}

export function OrgSwitcher() {
  const org = useOrg();
  const orgs = useQuery({ queryKey: keys.orgs, queryFn: () => api.organisations.list() });
  const { open, setOpen, ref } = usePopover();
  const o = org.data!;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${o.name}, switch company`}
        className={clsx(
          'flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-settle',
          open && 'bg-surface',
        )}
      >
        <Avatar name={o.name} seed={o.id} size="lg" solid />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight">{o.name}</span>
          <span
            className={clsx(
              'mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-px text-[11.5px] font-medium',
              o.chain === 'simulated' ? 'bg-pending-wash text-pending' : 'bg-settle-wash text-settle-strong',
            )}
          >
            <span className="truncate">{MODE_LABEL[o.executionMode]}</span>
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-faint" aria-hidden />
      </button>

      {open && (
        <PopoverPanel className="left-0 right-0 top-[calc(100%+6px)]">
          <p className="px-3.5 pb-1.5 pt-3 text-[12px] font-medium text-ink-faint">Your companies</p>
          <ul role="listbox" className="max-h-72 overflow-y-auto px-1.5 pb-1.5">
            {orgs.data?.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/o/${x.id}`}
                  onClick={() => setOpen(false)}
                  role="option"
                  aria-selected={x.id === o.id}
                  className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-wash"
                >
                  <Avatar name={x.name} seed={x.id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{x.name}</span>
                    <span className="block truncate text-[12px] text-ink-faint">
                      {orgSummary(x)} · {x.role.charAt(0) + x.role.slice(1).toLowerCase()}
                    </span>
                  </span>
                  {x.id === o.id && <Check className="size-4 text-settle" aria-hidden />}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/onboarding"
            className="flex items-center gap-2 border-t border-line px-3.5 py-3 text-sm font-medium text-settle hover:bg-wash"
          >
            <Plus className="size-4" /> Add a company
          </Link>
        </PopoverPanel>
      )}
    </div>
  );
}
