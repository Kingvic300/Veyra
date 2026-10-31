'use client';

import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { attentionReason, needsAttention } from '@/lib/attention';
import { relative } from '@/lib/format';
import { keys, useOrg } from '@/lib/hooks';
import { ACTION_COPY } from '@/lib/audit-copy';

/**
 * In-app notifications built from real data: batches waiting on this person
 * and the latest audit activity. Unread state is kept per organisation in the
 * browser (the last audit entry seen).
 */
export function NotificationBell() {
  const org = useOrg();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const storageKey = `veyra:seen:${org.orgId}`;

  const batches = useQuery({ queryKey: keys.batches(org.orgId), queryFn: () => api.batches.list(org.orgId), refetchInterval: 30_000 });
  const activity = useQuery({
    queryKey: [...keys.audit(org.orgId), 'latest'],
    queryFn: () => api.audit.list(org.orgId, { limit: 8 }),
    refetchInterval: 30_000,
  });

  useEffect(() => setLastSeen(Number(localStorage.getItem(storageKey) ?? 0)), [storageKey]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const waiting = needsAttention(batches.data ?? [], org.can);
  const latestSeq = activity.data?.[0]?.seq ?? 0;
  const unreadActivity = (activity.data ?? []).filter((e) => e.seq > lastSeen).length;
  const count = waiting.length + unreadActivity;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && latestSeq) {
      localStorage.setItem(storageKey, String(latestSeq));
      // Keep highlights visible while the panel is open; clear on next open.
      setTimeout(() => setLastSeen(latestSeq), 4000);
    }
  }

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={count ? `Notifications, ${count} new` : 'Notifications'}
        className="relative flex size-10 items-center justify-center rounded-control border border-line bg-surface text-ink-soft hover:bg-wash hover:text-ink"
      >
        <Bell className="size-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fail px-1 text-[11px] font-semibold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-[min(340px,calc(100vw-2.5rem))] overflow-hidden rounded-panel border border-line bg-surface shadow-[0_18px_48px_-20px_rgba(19,32,27,0.45)] lg:left-auto lg:right-0">
          <section>
            <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">Waiting on you</h3>
            {waiting.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-soft">Nothing needs you right now.</p>
            ) : (
              <ul>
                {waiting.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <Link href={`/o/${org.orgId}/batches/${b.id}`} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-wash">
                      <span className="block truncate text-sm font-medium">{b.title}</span>
                      <span className="block text-[12.5px] text-pending">{attentionReason(b)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="border-t border-line">
            <h3 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">Recent activity</h3>
            <ul className="max-h-72 overflow-y-auto">
              {(activity.data ?? []).map((e) => (
                <li key={e.id} className={clsx('flex items-start gap-2 px-4 py-2.5', e.seq > lastSeen && 'bg-settle-wash/50')}>
                  <span className={clsx('mt-2 size-1.5 shrink-0 rounded-full', e.seq > lastSeen ? 'bg-settle' : 'bg-line-strong')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm">{ACTION_COPY[e.action] ?? e.action}</span>
                    <span className="block text-[12px] text-ink-faint">{relative(e.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`/o/${org.orgId}/audit`} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-[13px] font-medium text-settle hover:bg-wash">
              Open the audit log
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
