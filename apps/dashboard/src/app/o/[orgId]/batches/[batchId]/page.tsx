'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { TransactionKind, UnsignedTransaction } from '@veyra/sdk';
import { PrivacyPanel, SettlementRail, StatusPill } from '@/components/batch-bits';
import { BatchEditor } from '@/components/batch-editor';
import { useNotify, useToast, useWallet } from '@/components/providers';
import { Button, Dialog, Field, Hash, Input, Notice, Panel, Pill, Spinner, Table } from '@/components/ui';
import { WalletPicker } from '@/components/wallet-button';
import { API_URL, VeyraApiError, api, errorMessage } from '@/lib/api';
import { amount, date, explorerUrl } from '@/lib/format';
import { keys, useCapabilities, useMe, useOrg } from '@/lib/hooks';
import { sameAddress, type ConnectedWallet } from '@/lib/wallet';

export default function BatchPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const org = useOrg();
  const me = useMe();
  const caps = useCapabilities();
  const qc = useQueryClient();
  const toast = useToast();
  const notify = useNotify();
  const { wallet } = useWallet();
  const [walletOpen, setWalletOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [onchainCancel, setOnchainCancel] = useState<UnsignedTransaction | null>(null);
  const orgId = org.orgId;
  const o = org.data!;

  const batch = useQuery({
    queryKey: keys.batch(orgId, batchId),
    queryFn: () => api.batches.get(orgId, batchId),
    refetchInterval: (q) => {
      const b = q.state.data;
      if (!b) return false;
      const waiting =
        b.status === 'EXECUTING' || b.proposal.status === 'PENDING' || b.approvals?.some((a) => a.status === 'PENDING_CHAIN');
      return waiting ? 4000 : false;
    },
  });
  const members = useQuery({ queryKey: keys.members(orgId), queryFn: () => api.members.list(orgId) });
  const validation = useQuery({
    queryKey: [...keys.batch(orgId, batchId), 'validation', batch.data?.total],
    queryFn: () => api.batches.validate(orgId, batchId),
    enabled: batch.data?.status === 'DRAFT',
  });

  const self = members.data?.find((m) => m.userId === me.data?.id);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: keys.batch(orgId, batchId) });
    await qc.invalidateQueries({ queryKey: keys.batches(orgId) });
    await qc.invalidateQueries({ queryKey: keys.treasury(orgId) });
  };

  async function requireWallet(): Promise<ConnectedWallet | null> {
    if (wallet) return wallet;
    setWalletOpen(true);
    return null;
  }

  /** Ask the API for the unsigned call, let the wallet sign it, return the hash. */
  async function signChainAction(kind: TransactionKind): Promise<string | null> {
    const w = await requireWallet();
    if (!w) return null;
    const tx = await api.batches.chainAction(orgId, batchId, kind);
    const actions = tx.extra?.strk20Actions as unknown[] | undefined;
    if (actions) {
      if (!w.strk20) throw new Error('This wallet cannot send STRK20 private transfers. Connect a Wallet Standard privacy wallet.');
      return w.strk20(actions);
    }
    return w.execute(tx.calls);
  }

  const action = useMutation({
    mutationFn: async (kind: 'submit' | 'propose' | 'approve' | 'execute' | 'reconcile') => {
      const c = caps.data!;
      switch (kind) {
        case 'submit':
          return api.batches.submit(orgId, batchId);
        case 'propose': {
          const hash = await signChainAction('propose');
          return hash ? api.batches.recordProposal(orgId, batchId, hash) : null;
        }
        case 'approve': {
          if (!c.onChainApprovals) return api.batches.approve(orgId, batchId);
          const hash = await signChainAction('approve');
          return hash ? api.batches.approve(orgId, batchId, hash) : null;
        }
        case 'execute': {
          if (c.signing === 'server-simulated') return api.batches.execute(orgId, batchId);
          const hash = await signChainAction('execute');
          return hash ? api.batches.execute(orgId, batchId, hash) : null;
        }
        case 'reconcile':
          return api.batches.reconcile(orgId, batchId);
      }
    },
    onSuccess: async (result, kind) => {
      if (result === null) return;
      const done: Record<string, [string, string]> = {
        submit: ['Sent for approval', 'Approvers can review it now.'],
        propose: ['Registration sent', 'Waiting for the block to confirm it.'],
        approve: caps.data?.onChainApprovals ? ['Approval sent', 'It counts once the block confirms it.'] : ['Approved', 'Your approval is recorded.'],
        execute: ['Payment sent', 'Settling now. This page updates when it is final.'],
        reconcile: ['Checking the chain again', 'Status updates in a few seconds.'],
      };
      toast('settle', done[kind]![0], done[kind]![1]);
      await refresh();
    },
    onError: (err, kind) => {
      if (err instanceof VeyraApiError) {
        toast('fail', 'Veyra could not record that', errorMessage(err));
        return;
      }
      // Anything else came from the wallet or the network before Veyra saw it.
      notify.alert({
        tone: 'error',
        title: kind === 'approve' ? 'Approval was not sent' : kind === 'execute' ? 'Payment was not sent' : 'Transaction was not sent',
        body: (
          <>
            <p>{errorMessage(err)}</p>
            <p className="mt-2">Nothing was recorded and no funds moved. You can try again.</p>
          </>
        ),
      });
    },
  });

  // Announce outcomes that arrive later from the chain while this page is open.
  const previous = useRef<{ status?: string; proposal?: string }>({});
  useEffect(() => {
    const b = batch.data;
    if (!b) return;
    const prev = previous.current;
    if (prev.status === 'EXECUTING' && b.status === 'COMPLETED') {
      notify.alert({
        tone: 'success',
        title: 'Batch paid',
        body: `${b.itemCount} contractors received ${amount(b.total, b.asset)}. Every payment was checked against the settlement transaction.`,
        action: { label: 'View receipt', href: `/o/${orgId}/batches/${batchId}/receipt` },
      });
    } else if (prev.status === 'EXECUTING' && b.status === 'FAILED') {
      notify.alert({
        tone: 'error',
        title: 'Payment did not go through',
        body: `${b.executions?.at(-1)?.error ?? 'The transaction failed'}. No funds left the treasury, so you can retry.`,
      });
    } else if (prev.status === 'PENDING_APPROVAL' && b.status === 'APPROVED') {
      toast('settle', 'Batch fully approved', 'It is ready to pay.');
    }
    if (prev.proposal === 'PENDING' && b.proposal.status === 'CONFIRMED') toast('settle', 'Registered on-chain', 'Approvers can now sign this batch.');
    if (prev.proposal === 'PENDING' && b.proposal.status === 'FAILED') {
      notify.alert({ tone: 'error', title: 'On-chain registration failed', body: 'The vault did not accept the batch. Check the transaction in the explorer, then register again.' });
    }
    previous.current = { status: b.status, proposal: b.proposal.status };
  }, [batch.data, notify, toast, orgId, batchId]);

  const cancel = useMutation({
    mutationFn: (reason: string) => api.batches.cancel(orgId, batchId, reason || undefined),
    onSuccess: async (r) => {
      setCancelOpen(false);
      toast('neutral', 'Batch cancelled');
      if (r.onchainCancel) setOnchainCancel(r.onchainCancel);
      await refresh();
    },
    onError: (err) => toast('fail', 'Could not cancel', errorMessage(err)),
  });

  if (batch.isLoading || caps.isLoading) return <Spinner />;
  if (batch.isError || !batch.data || !caps.data) return <Notice tone="fail">{errorMessage(batch.error)}</Notice>;
  const b = batch.data;
  const c = caps.data;
  const base = `/o/${orgId}/batches/${batchId}`;

  if (editing && b.items) {
    return (
      <>
        <h1 className="mb-8 text-[28px] font-semibold">Edit draft</h1>
        <BatchEditor
          orgId={orgId}
          asset={b.asset}
          initial={{ title: b.title, items: b.items }}
          submitLabel="Save changes"
          onSave={async (draft) => {
            await api.batches.update(orgId, batchId, draft);
            await refresh();
            setEditing(false);
            toast('settle', 'Changes saved');
          }}
        />
      </>
    );
  }

  const myApproval = b.approvals?.find((a) => a.memberId === self?.id && a.status !== 'FAILED');
  const isCreator = b.createdBy === self?.id;
  const approvalBlocked = !o.approvalPolicy.allowCreatorApproval && isCreator;
  const needsProposal = c.requiresProposal && b.status === 'PENDING_APPROVAL' && (b.proposal.status === 'NONE' || b.proposal.status === 'FAILED');
  const walletMismatch = c.onChainApprovals && wallet && self?.walletAddress && !sameAddress(wallet.address, self.walletAddress);
  const canCancel = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'FAILED'].includes(b.status) && org.can('batches:write');
  const lastExecution = b.executions?.at(-1);

  // The single next action for this person, shown as the primary button.
  let primary: { label: string; kind: 'submit' | 'propose' | 'approve' | 'execute' | 'reconcile'; disabled?: boolean; note?: string } | null = null;
  if (b.status === 'DRAFT' && org.can('batches:write')) {
    primary = { label: 'Send for approval', kind: 'submit', disabled: validation.data ? !validation.data.ok : true };
  } else if (needsProposal && org.can('batches:write')) {
    primary = { label: b.proposal.status === 'FAILED' ? 'Register on-chain again' : 'Register on-chain', kind: 'propose', note: 'Your wallet registers the frozen batch with the vault so approvers can sign it.' };
  } else if (b.status === 'PENDING_APPROVAL' && org.can('batches:approve') && !myApproval && !approvalBlocked && !needsProposal && b.proposal.status !== 'PENDING') {
    primary = {
      label: c.onChainApprovals ? 'Approve with wallet' : 'Approve batch',
      kind: 'approve',
      disabled: c.onChainApprovals && !self?.walletAddress,
      note: c.onChainApprovals && !self?.walletAddress ? 'Link your approver wallet on the Team page first.' : undefined,
    };
  } else if ((b.status === 'APPROVED' || b.status === 'FAILED') && org.can('batches:execute')) {
    primary = { label: `${b.status === 'FAILED' ? 'Retry payment' : 'Pay'} ${b.itemCount} contractors`, kind: 'execute' };
  } else if (b.status === 'EXECUTING' || b.proposal.status === 'PENDING') {
    primary = { label: 'Check the chain again', kind: 'reconcile' };
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <Link href={`/o/${orgId}/batches`} className="text-sm text-ink-soft hover:text-ink">
            Payroll
          </Link>
          <h1 className="mt-1 text-[28px] font-semibold">{b.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            <StatusPill status={b.status} />
            <span>Created {date(b.createdAt)}</span>
            <Pill tone={b.shielded ? 'settle' : 'neutral'}>{b.privacyLabel}</Pill>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-soft">{b.itemCount} payments</p>
          <p className="text-[30px] font-semibold leading-tight tracking-[-0.02em]">{amount(b.total, b.asset)}</p>
        </div>
      </div>

      <section className="rounded-panel border border-line bg-surface p-6" aria-label="Settlement">
        <SettlementRail batch={b} chain={o.chain} network={o.network} requiresProposal={c.requiresProposal} />
        {(primary || canCancel || b.status === 'DRAFT' || (b.status === 'PENDING_APPROVAL' && (myApproval || approvalBlocked))) && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            {primary && (
              <Button
                onClick={() => action.mutate(primary!.kind)}
                loading={action.isPending}
                disabled={primary.disabled}
                variant={primary.kind === 'reconcile' ? 'secondary' : 'primary'}
                icon={primary.kind === 'reconcile' ? <RefreshCw className="size-4" /> : undefined}
              >
                {primary.label}
              </Button>
            )}
            {b.status === 'DRAFT' && org.can('batches:write') && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit draft
              </Button>
            )}
            {canCancel && (
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                Cancel batch
              </Button>
            )}
            {primary?.note && <p className="text-[13px] text-ink-soft">{primary.note}</p>}
            {myApproval && b.status === 'PENDING_APPROVAL' && <p className="text-[13px] text-ink-soft">You approved this batch.</p>}
            {approvalBlocked && b.status === 'PENDING_APPROVAL' && (
              <p className="text-[13px] text-ink-soft">You created this batch, so someone else has to approve it.</p>
            )}
          </div>
        )}
        {walletMismatch && (
          <div className="mt-4">
            <Notice tone="pending">
              The connected wallet is not the one linked to your membership. On-chain approvals from it will not count.
            </Notice>
          </div>
        )}
        {b.proposal.status === 'FAILED' && <div className="mt-4"><Notice tone="fail" title="On-chain registration failed">Check the transaction in the explorer, then register again.</Notice></div>}
        {lastExecution?.status === 'FAILED' && lastExecution.error && (
          <div className="mt-4">
            <Notice tone="fail" title="Payment did not go through">
              {lastExecution.error}. No funds moved, so retrying is safe.
            </Notice>
          </div>
        )}
      </section>

      {b.status === 'DRAFT' && validation.data && validation.data.issues.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {validation.data.issues.map((i, n) => (
            <Notice key={n} tone={i.severity === 'error' ? 'fail' : 'pending'}>
              {i.itemIndex !== undefined && b.items?.[i.itemIndex] ? `${b.items[i.itemIndex]!.contractorName}: ` : ''}
              {i.message}
            </Notice>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <Panel
            title="Payments"
            padded={false}
            action={
              b.status === 'COMPLETED' && b.items ? (
                <div className="flex gap-2">
                  <Link href={`${base}/receipt`}>
                    <Button size="sm" variant="secondary" icon={<FileText className="size-4" />}>
                      Receipt
                    </Button>
                  </Link>
                  <a href={`${API_URL}/organisations/${orgId}/batches/${batchId}/receipt.csv`}>
                    <Button size="sm" variant="ghost" icon={<Download className="size-4" />}>
                      CSV
                    </Button>
                  </a>
                </div>
              ) : undefined
            }
          >
            {b.items ? (
              <Table>
                <thead>
                  <tr>
                    <th>Contractor</th>
                    <th>Payout wallet</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {b.items.map((item) => {
                    const p = b.payments?.find((x) => x.itemId === item.id);
                    return (
                      <tr key={item.id}>
                        <td className="font-medium">{item.contractorName}</td>
                        <td>{item.recipient && <Hash value={item.recipient} />}</td>
                        <td className="text-right font-medium">{amount(item.amount, b.asset)}</td>
                        <td>
                          {p ? (
                            <Pill tone={p.status === 'CONFIRMED' ? 'settle' : p.status === 'FAILED' ? 'fail' : 'pending'}>
                              {p.status === 'CONFIRMED' ? (p.verified ? 'Paid, verified' : 'Paid') : p.status === 'FAILED' ? 'Not paid' : 'Settling'}
                            </Pill>
                          ) : (
                            <span className="text-[13px] text-ink-faint">Not sent</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <p className="p-5 text-sm text-ink-soft">Your role sees batch totals only. Contractor details are limited to owners, admins and approvers.</p>
            )}
          </Panel>

          {(b.executions?.length ?? 0) > 0 && (
            <Panel title="Payment attempts" padded={false}>
              <ul>
                {b.executions!.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-sm first:border-t-0">
                    <span className="flex items-center gap-3">
                      <span className="text-ink-soft">Attempt {e.attempt}</span>
                      <Pill tone={e.status === 'CONFIRMED' ? 'settle' : e.status === 'FAILED' ? 'fail' : 'pending'} live={e.status === 'SUBMITTED'}>
                        {e.status === 'CONFIRMED' ? 'Settled' : e.status === 'FAILED' ? 'Failed' : 'Waiting for the block'}
                      </Pill>
                    </span>
                    {e.txHash && <Hash value={e.txHash} href={explorerUrl(o.chain, o.network, 'tx', e.txHash)} />}
                    {e.verification && (
                      <p className="w-full text-[13px] text-ink-soft">{[...e.verification.details, ...e.verification.mismatches].join(' ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <Panel title="Approvals">
            <p className="text-sm text-ink-soft">
              {b.approvalSummary.confirmed} of {b.approvalSummary.required} required
              {c.onChainApprovals ? ', each signed on-chain by the approver wallet.' : ', recorded by Veyra.'}
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {b.approvals?.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{a.memberName}</span>
                  <span className="flex items-center gap-2">
                    {a.txHash && <Hash value={a.txHash} href={explorerUrl(o.chain, o.network, 'tx', a.txHash)} />}
                    <Pill tone={a.status === 'CONFIRMED' ? 'settle' : a.status === 'FAILED' ? 'fail' : 'pending'} live={a.status === 'PENDING_CHAIN'}>
                      {a.status === 'CONFIRMED' ? 'Approved' : a.status === 'FAILED' ? 'Failed' : 'Confirming'}
                    </Pill>
                  </span>
                </li>
              ))}
              {(b.approvals?.length ?? 0) === 0 && <li className="text-sm text-ink-faint">No approvals yet.</li>}
            </ul>
            {b.approvalSummary.unreachable && (
              <div className="mt-4">
                <Notice tone="pending">Not enough members can approve to reach the threshold. Add approvers on the Team page.</Notice>
              </div>
            )}
          </Panel>

          <Panel title="Who can see what">
            <PrivacyPanel privacy={c.privacy} />
          </Panel>

          {b.commitment && (
            <Panel title="Proof of contents">
              <p className="text-[13px] text-ink-soft">
                Fingerprints of the exact recipients and amounts, fixed when the batch was submitted. Any later change would produce different values.
              </p>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="mb-1 text-ink-soft">Batch commitment (SHA-256)</dt>
                  <dd>
                    <Hash value={b.commitment} />
                  </dd>
                </div>
                {b.chainItemsHash && (
                  <div>
                    <dt className="mb-1 text-ink-soft">Vault items hash (Poseidon)</dt>
                    <dd>
                      <Hash value={b.chainItemsHash} />
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="mb-1 text-ink-soft">On-chain batch id</dt>
                  <dd>
                    <Hash value={b.chainBatchId} />
                  </dd>
                </div>
              </dl>
            </Panel>
          )}
        </div>
      </div>

      <WalletPicker open={walletOpen} onClose={() => setWalletOpen(false)} />

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this batch?">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            cancel.mutate(String(new FormData(e.currentTarget).get('reason') ?? ''));
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-ink-soft">Nobody will be paid from it. Cancelled batches stay in the audit log.</p>
          <Field label="Reason (optional)" htmlFor="reason">
            <Input id="reason" name="reason" maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep batch
            </Button>
            <Button type="submit" variant="danger" loading={cancel.isPending}>
              Cancel batch
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!onchainCancel} onClose={() => setOnchainCancel(null)} title="Cancel it on-chain too">
        <p className="text-sm text-ink-soft">
          This batch is registered with the vault. Cancelling it there stops anyone from executing it outside Veyra.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOnchainCancel(null)}>
            Later
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                const w = await requireWallet();
                if (!w || !onchainCancel) return;
                const hash = await w.execute(onchainCancel.calls);
                toast('settle', `On-chain cancellation sent (${hash.slice(0, 10)}…)`);
                setOnchainCancel(null);
              } catch (err) {
                toast('fail', errorMessage(err));
              }
            }}
          >
            Sign cancellation
          </Button>
        </div>
      </Dialog>
    </>
  );
}
