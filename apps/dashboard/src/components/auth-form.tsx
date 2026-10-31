'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { keys } from '@/lib/hooks';
import { Logo } from './logo';
import { HeroVisual } from './marketing/hero-visual';
import { useToast } from './providers';
import { Button, Field, Input } from './ui';

export function AuthForm({ mode, inviteToken }: { mode: 'login' | 'register'; inviteToken?: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const invite = useQuery({
    queryKey: ['invitation', inviteToken],
    queryFn: () => api.invitations.preview(inviteToken!),
    enabled: !!inviteToken,
    retry: false,
  });
  const inviteQuery = inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : '';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const email = String(form.get('email'));
      const password = String(form.get('password'));
      let joined: string | undefined;
      if (mode === 'register') {
        const r = await api.auth.register({ email, password, name: String(form.get('name')), inviteToken: inviteToken ?? undefined });
        joined = r.joinedOrganisationId;
      } else {
        await api.auth.login({ email, password });
        if (inviteToken) joined = (await api.invitations.accept(inviteToken)).organisationId;
      }
      await qc.invalidateQueries({ queryKey: keys.me });
      await qc.invalidateQueries({ queryKey: keys.orgs });
      if (joined && invite.data) toast('settle', `You joined ${invite.data.organisationName}`);
      router.replace(joined ? `/o/${joined}` : '/app');
    } catch (err) {
      toast('fail', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <Logo className="mb-10 lg:hidden" />
        <h1 className="text-[26px] font-semibold">
          {invite.data ? `Join ${invite.data.organisationName}` : mode === 'login' ? 'Sign in' : 'Create your account'}
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {invite.data
            ? `${invite.data.invitedByName} invited you. ${mode === 'login' ? 'Sign in to accept.' : 'Create your account to accept.'}`
            : mode === 'login'
              ? 'Welcome back.'
              : 'Set up your company or join one after this.'}
        </p>
        {invite.isError && (
          <p className="mt-4 rounded-control bg-pending-wash px-3 py-2 text-[13px] text-pending">
            This invitation link is invalid or has expired. Ask the person who invited you for a new one.
          </p>
        )}
        <div className="mt-8 flex flex-col gap-4">
          {mode === 'register' && (
            <Field label="Your name" htmlFor="name">
              <Input id="name" name="name" required autoComplete="name" />
            </Field>
          )}
          <Field label="Work email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              key={invite.data?.email ?? 'email'}
              defaultValue={invite.data?.email}
              readOnly={!!invite.data && mode === 'register'}
              className={invite.data && mode === 'register' ? 'bg-wash' : undefined}
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            hint={
              mode === 'register' ? (
                'At least 8 characters.'
              ) : (
                <Link href="/forgot-password" className="hover:text-ink hover:underline">
                  Forgot your password?
                </Link>
              )
            }
          >
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={mode === 'register' ? 8 : 1}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </Field>
          <Button type="submit" loading={busy} className="mt-2 w-full">
            {invite.data ? (mode === 'login' ? 'Sign in and join' : 'Create account and join') : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
          {mode === 'register' && (
            <p className="text-[12.5px] text-ink-faint">
              By creating an account you agree to the{' '}
              <Link href="/legal/terms" className="underline hover:text-ink">
                terms of service
              </Link>{' '}
              and confirm you have read the{' '}
              <Link href="/legal/privacy" className="underline hover:text-ink">
                privacy policy
              </Link>
              .
            </p>
          )}
        </div>
        <p className="mt-6 text-sm text-ink-soft">
          {mode === 'login' ? (
            <>
              New to Veyra?{' '}
              <Link href={`/register${inviteQuery}`} className="font-medium text-settle hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link href={`/login${inviteQuery}`} className="font-medium text-settle hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}

/** Two-column frame shared by the sign-in, registration and password screens. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="block-grid relative hidden flex-col border-r border-line bg-[#f4f7f5] p-12 lg:flex">
        <Link href="/" aria-label="Veyra home">
          <Logo />
        </Link>
        <div className="my-auto w-full max-w-[600px] self-center py-10">
          <p className="max-w-[24ch] text-[30px] font-semibold leading-[1.15] tracking-[-0.02em]">
            Pay your team on-chain. Keep every salary between you and them.
          </p>
          <div className="mt-10">
            <HeroVisual />
          </div>
        </div>
        <p className="text-[13px] text-ink-faint">Open source under the Apache License 2.0. Veyra never holds your funds or keys.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">{children}</section>
    </main>
  );
}
