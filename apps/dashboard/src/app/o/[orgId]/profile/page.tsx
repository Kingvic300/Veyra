'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LogOut, Mail } from 'lucide-react';
import { Avatar } from '@/components/org-avatar';
import { ChangePasswordForm } from '@/components/password-forms';
import { useToast } from '@/components/providers';
import { Button, Dialog, Field, Input, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { date } from '@/lib/format';
import { keys, useMe } from '@/lib/hooks';

const ROLE_NAME: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin', APPROVER: 'Approver', VIEWER: 'Viewer' };

/** One settings section: title and explanation on the left, the controls on the right. */
function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-8 first:border-t-0 md:grid-cols-[280px_minmax(0,1fr)] md:gap-12">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const orgs = useQuery({ queryKey: keys.orgs, queryFn: () => api.organisations.list() });
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!me.data) return <Spinner />;
  const user = me.data;
  const draftName = name ?? user.name;
  const dirty = draftName.trim().length > 0 && draftName.trim() !== user.name;

  async function saveName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      await api.auth.updateProfile({ name: draftName.trim() });
      await qc.invalidateQueries({ queryKey: keys.me });
      setName(null);
      toast('settle', 'Name updated');
    } catch (err) {
      toast('fail', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function signOutEverywhere() {
    setSigningOut(true);
    try {
      await api.auth.signOutEverywhere();
      sessionStorage.removeItem('veyra:signed-in');
      qc.clear();
      router.replace('/login');
    } catch (err) {
      toast('fail', errorMessage(err));
      setSigningOut(false);
    }
  }

  return (
    <div>
      {/* Identity header */}
      <header className="flex flex-wrap items-center gap-5 rounded-panel border border-line bg-surface p-6">
        <span className="[&>span]:size-16 [&>span]:text-xl">
          <Avatar name={draftName || user.name} seed={user.id} size="lg" round solid />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] font-semibold tracking-[-0.02em]">{user.name}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink-soft">
            <Mail className="size-3.5 shrink-0" aria-hidden />
            {user.email}
          </p>
        </div>
        <dl className="flex gap-8 text-sm">
          <div>
            <dt className="text-ink-faint">Companies</dt>
            <dd className="mt-0.5 font-semibold">{orgs.data?.length ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Member since</dt>
            <dd className="mt-0.5 font-semibold">{date(user.createdAt)}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-2">
        <Section title="Personal details" description="Your team sees your name on approvals, payouts and in the history.">
          <form onSubmit={saveName} className="flex flex-col gap-4">
            <Field label="Full name" htmlFor="name">
              <Input id="name" value={draftName} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />
            </Field>
            <Field label="Email" htmlFor="email" hint="You sign in with this address. It cannot be changed yet.">
              <Input id="email" value={user.email} readOnly className="bg-wash text-ink-soft" autoComplete="off" />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" loading={saving} disabled={!dirty}>
                Save changes
              </Button>
              {dirty && (
                <button type="button" onClick={() => setName(null)} className="text-sm text-ink-soft hover:text-ink">
                  Discard
                </button>
              )}
            </div>
          </form>
        </Section>

        <Section
          title="Password"
          description="Changing it signs you out on your other devices. This browser stays signed in."
        >
          <div>
            <ChangePasswordForm inline onDone={() => undefined} />
          </div>
        </Section>

        <Section title="Your companies" description="Every company you belong to, and what you can do in each.">
          <div className="overflow-hidden rounded-panel border border-line bg-surface">
            {orgs.isLoading ? (
              <div className="p-5">
                <Spinner />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {orgs.data?.map((o) => (
                  <li key={o.id}>
                    <Link href={`/o/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-wash">
                      <Avatar name={o.name} seed={o.id} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.name}</span>
                        <span className="block text-[12.5px] text-ink-faint">{o.chain === 'simulated' ? 'Practice mode' : 'Real money'}</span>
                      </span>
                      <span className="rounded-full bg-wash px-2 py-0.5 text-[12px] font-medium text-ink-soft">{ROLE_NAME[o.role] ?? o.role}</span>
                      <ChevronRight className="size-4 text-ink-faint" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section title="Sign out everywhere" description="Lost a laptop or phone? End every session at once. You can sign straight back in.">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-fail/25 bg-fail-wash/40 p-4">
            <p className="text-sm text-ink-soft">Signs out every browser and device, including this one.</p>
            <Button variant="danger" icon={<LogOut className="size-4" />} onClick={() => setConfirmOut(true)}>
              Sign out on all devices
            </Button>
          </div>
        </Section>
      </div>

      <Dialog open={confirmOut} onClose={() => setConfirmOut(false)} title="Sign out on all devices?">
        <p className="text-sm text-ink-soft">Every browser and app signed in as {user.email} is signed out, including this one.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOut(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={signOutEverywhere} loading={signingOut}>
            Sign out everywhere
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
