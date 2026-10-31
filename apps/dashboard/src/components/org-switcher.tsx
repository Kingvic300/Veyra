'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { networkLabel } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';
import { Avatar } from './org-avatar';
import { PopoverPanel, usePopover } from './popover';

const MODE_LABEL = { vault: 'Payroll vault', 'strk20-private': 'STRK20 private', simulated: 'Sandbox' } as const;

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
        className="flex w-full items-center gap-3 rounded-[12px] border border-line bg-surface p-2.5 text-left shadow-[0_1px_0_rgba(19,32,27,0.04)] transition-colors hover:border-line-strong"
      >
        <Avatar name={o.name} seed={o.id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold leading-tight">{o.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
            <span className={`size-1.5 rounded-full ${o.chain === 'simulated' ? 'bg-pending' : 'bg-settle'}`} aria-hidden />
            {networkLabel(o.chain, o.network)}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-faint" aria-hidden />
      </button>

      {open && (
        <PopoverPanel className="left-0 right-0 top-[calc(100%+6px)]">
          <p className="px-3.5 pb-1.5 pt-3 text-[12px] font-medium text-ink-faint">Your organisations</p>
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
                    <span className="block text-[12px] text-ink-faint">
                      {MODE_LABEL[x.executionMode]}, {x.role.charAt(0) + x.role.slice(1).toLowerCase()}
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
            <Plus className="size-4" /> Create organisation
          </Link>
        </PopoverPanel>
      )}
    </div>
  );
}
