'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './auth-form';
import { Logo } from './logo';
import { useToast } from './providers';
import { Button, Field, Input, Notice } from './ui';

export function ForgotPasswordForm() {
  const toast = useToast();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    setBusy(true);
    try {
      await api.auth.forgotPassword({ email });
      setSentTo(email);
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
        <h1 className="text-[26px] font-semibold">Reset your password</h1>
        {sentTo ? (
          <>
            <p className="mt-1.5 text-sm text-ink-soft">
              If <span className="font-medium text-ink">{sentTo}</span> has a Veyra account, a reset link is on its way. The link works for 30
              minutes.
            </p>
            <div className="mt-6">
              <Notice tone="neutral">No email after a few minutes? Check your spam folder, or try again.</Notice>
            </div>
            <Button type="button" variant="secondary" className="mt-6 w-full" onClick={() => setSentTo(null)}>
              Use a different email
            </Button>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className="mt-1.5 text-sm text-ink-soft">Enter the email you sign in with. We will send you a link to choose a new password.</p>
            <div className="mt-8 flex flex-col gap-4">
              <Field label="Work email" htmlFor="email">
                <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
              </Field>
              <Button type="submit" loading={busy} className="mt-2 w-full">
                Send reset link
              </Button>
            </div>
          </form>
        )}
        <p className="mt-6 text-sm text-ink-soft">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-settle hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirm'))) {
      toast('fail', 'The two passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api.auth.resetPassword({ token: token!, password });
      sessionStorage.removeItem('veyra:signed-in');
      qc.clear();
      toast('settle', 'Password changed. Sign in with your new password.');
      router.replace('/login');
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
        <h1 className="text-[26px] font-semibold">Choose a new password</h1>
        {!token ? (
          <>
            <p className="mt-1.5 text-sm text-ink-soft">This reset link is incomplete. Open the link from your email again, or request a new one.</p>
            <Link href="/forgot-password" className="mt-6 inline-block text-sm font-medium text-settle hover:underline">
              Request a new link
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className="mt-1.5 text-sm text-ink-soft">This signs you out on every device. Sign in again afterwards.</p>
            <div className="mt-8 flex flex-col gap-4">
              <Field label="New password" htmlFor="password" hint="At least 8 characters.">
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
              </Field>
              <Field label="Confirm new password" htmlFor="confirm">
                <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
              </Field>
              <Button type="submit" loading={busy} className="mt-2 w-full">
                Set new password
              </Button>
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Link expired?{' '}
              <Link href="/forgot-password" className="font-medium text-settle hover:underline">
                Request a new one
              </Link>
            </p>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

/** Body of the change-password dialog in the account menu. */
export function ChangePasswordForm({ onDone, inline = false }: { onDone: () => void; inline?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get('newPassword'));
    if (newPassword !== String(form.get('confirm'))) {
      toast('fail', 'The two new passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api.auth.changePassword({ currentPassword: String(form.get('currentPassword')), newPassword });
      (e.target as HTMLFormElement).reset();
      toast('settle', 'Password changed. Other devices are signed out.');
      onDone();
    } catch (err) {
      toast('fail', errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Current password" htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" autoFocus />
      </Field>
      <Field label="New password" htmlFor="newPassword" hint="At least 8 characters. Other devices will be signed out.">
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <div className={inline ? 'mt-2 flex gap-2' : 'mt-2 flex justify-end gap-2'}>
        {!inline && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy}>
          Change password
        </Button>
      </div>
    </form>
  );
}
