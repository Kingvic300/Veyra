'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { keys, useMe } from '@/lib/hooks';
import { AuthLayout } from './auth-form';
import { Logo } from './logo';
import { useToast } from './providers';
import { Button, Spinner } from './ui';

const ROLE_COPY: Record<string, string> = {
  OWNER: 'an owner. You can do everything, including managing other owners.',
  ADMIN: 'an admin. You can manage the team, people and payouts, and approve and pay.',
  APPROVER: 'an approver. You check payouts and approve them before money moves.',
  VIEWER: 'a viewer. You can see totals and history, but not who is paid what.',
};

/** Landing page for an invitation link: join now if signed in, otherwise sign up or sign in first. */
export function InvitePage({ token }: { token: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const invite = useQuery({ queryKey: ['invitation', token], queryFn: () => api.invitations.preview(token), retry: false });
  const q = `?invite=${encodeURIComponent(token)}`;

  async function join() {
    setBusy(true);
    try {
      const { organisationId } = await api.invitations.accept(token);
      await qc.invalidateQueries({ queryKey: keys.orgs });
      toast('settle', `You joined ${invite.data?.organisationName ?? 'the organisation'}`);
      router.replace(`/o/${organisationId}`);
    } catch (err) {
      toast('fail', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <Logo className="mb-10 lg:hidden" />
        {invite.isLoading ? (
          <Spinner label="Opening invitation" />
        ) : invite.isError || !invite.data ? (
          <>
            <h1 className="text-[26px] font-semibold">This invitation has expired</h1>
            <p className="mt-2 text-sm text-ink-soft">
              The link is invalid, was already used, or is more than 7 days old. Ask the person who invited you to send a new one.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm font-medium text-settle hover:underline">
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-soft">{invite.data.invitedByName} invited you to</p>
            <h1 className="mt-1 text-[26px] font-semibold">{invite.data.organisationName}</h1>
            <p className="mt-3 text-sm text-ink-soft">You will join as {ROLE_COPY[invite.data.role] ?? invite.data.role.toLowerCase()}</p>
            <p className="mt-3 text-[13px] text-ink-faint">Invitation for {invite.data.email}</p>
            <div className="mt-8 flex flex-col gap-3">
              {me.data ? (
                me.data.email === invite.data.email ? (
                  <Button onClick={join} loading={busy} className="w-full">
                    Join {invite.data.organisationName}
                  </Button>
                ) : (
                  <p className="rounded-control bg-pending-wash px-3 py-2 text-[13px] text-pending">
                    You are signed in as {me.data.email}. Sign out, then open this link again and sign in as {invite.data.email}.
                  </p>
                )
              ) : (
                <>
                  <Link
                    href={`/register${q}`}
                    className="inline-flex h-10 items-center justify-center rounded-control bg-settle px-4 text-sm font-medium text-white hover:bg-settle-strong"
                  >
                    Create an account and join
                  </Link>
                  <Link
                    href={`/login${q}`}
                    className="inline-flex h-10 items-center justify-center rounded-control border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-wash"
                  >
                    I already have an account
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
