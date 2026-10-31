'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { keys } from '@/lib/hooks';
import { Logo } from './logo';
import { Button, Field, Input, Notice } from './ui';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const email = String(form.get('email'));
      const password = String(form.get('password'));
      if (mode === 'register') await api.auth.register({ email, password, name: String(form.get('name')) });
      else await api.auth.login({ email, password });
      await qc.invalidateQueries({ queryKey: keys.me });
      router.replace('/app');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="block-grid relative hidden flex-col justify-between border-r border-line bg-paper p-12 lg:flex">
        <Link href="/" aria-label="Veyra home">
          <Logo />
        </Link>
        <div className="max-w-[30rem]">
          <p className="text-[34px] font-semibold leading-[1.12] tracking-[-0.02em]">
            Pay your team on-chain. Keep every salary between you and them.
          </p>
          <p className="mt-5 max-w-[42ch] text-ink-soft">
            Build a payroll batch, collect approvals from the people who sign off on money, settle it on Starknet and keep a receipt
            anyone can check.
          </p>
        </div>
        <ul className="grid max-w-[30rem] grid-cols-3 gap-px overflow-hidden rounded-panel border border-line bg-line text-[13px]">
          {[
            ['Approvals', 'enforced by the vault contract'],
            ['Records', 'encrypted at rest'],
            ['Receipts', 'verified against chain events'],
          ].map(([a, b]) => (
            <li key={a} className="bg-surface p-4">
              <p className="font-semibold">{a}</p>
              <p className="mt-1 text-ink-soft">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-[26px] font-semibold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {mode === 'login' ? 'Welcome back. Pending approvals are waiting for you.' : 'You can create an organisation or join one after this.'}
          </p>
          <div className="mt-8 flex flex-col gap-4">
            {mode === 'register' && (
              <Field label="Your name" htmlFor="name">
                <Input id="name" name="name" required autoComplete="name" />
              </Field>
            )}
            <Field label="Work email" htmlFor="email">
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Password" htmlFor="password" hint={mode === 'register' ? 'At least 12 characters.' : undefined}>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={mode === 'register' ? 12 : 1}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </Field>
            {error && <Notice tone="fail">{error}</Notice>}
            <Button type="submit" loading={busy} className="mt-2 w-full">
              {mode === 'login' ? 'Sign in' : 'Create account'}
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
                <Link href="/register" className="font-medium text-settle hover:underline">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-settle hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}
