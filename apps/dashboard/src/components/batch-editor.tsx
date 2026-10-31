'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AmountError, formatUnits, parseUnits, type Asset, type PayrollItem } from '@veyra/core';
import { api, errorMessage } from '@/lib/api';
import { amount } from '@/lib/format';
import { keys } from '@/lib/hooks';
import { Button, Empty, Field, Input, Notice, Select } from './ui';

interface Row {
  key: number;
  contractorId: string;
  amount: string;
}

export interface BatchDraft {
  title: string;
  items: { contractorId: string; amount: string }[];
}

let nextKey = 1;

export function BatchEditor({
  orgId,
  asset,
  initial,
  submitLabel,
  onSave,
}: {
  orgId: string;
  asset: Asset;
  initial?: { title: string; items: PayrollItem[] };
  submitLabel: string;
  onSave: (draft: BatchDraft) => Promise<unknown>;
}) {
  const contractors = useQuery({ queryKey: keys.contractors(orgId), queryFn: () => api.contractors.list(orgId) });
  const [title, setTitle] = useState(initial?.title ?? defaultTitle());
  const [rows, setRows] = useState<Row[]>(
    initial?.items.map((i) => ({ key: nextKey++, contractorId: i.contractorId, amount: formatUnits(i.amount, asset.decimals) })) ?? [
      { key: nextKey++, contractorId: '', amount: '' },
    ],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const used = new Set(rows.map((r) => r.contractorId).filter(Boolean));
  const totals = useMemo(() => {
    let total = 0n;
    const invalid = new Set<number>();
    for (const r of rows) {
      if (!r.amount) continue;
      try {
        total += parseUnits(r.amount, asset.decimals);
      } catch (e) {
        if (e instanceof AmountError) invalid.add(r.key);
      }
    }
    return { total, invalid };
  }, [rows, asset.decimals]);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addEveryone() {
    const missing = (contractors.data ?? []).filter((c) => !used.has(c.id));
    setRows((rs) => [...rs.filter((r) => r.contractorId || r.amount), ...missing.map((c) => ({ key: nextKey++, contractorId: c.id, amount: '' }))]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const items = rows.filter((r) => r.contractorId || r.amount);
    if (items.some((r) => !r.contractorId || !r.amount)) return setError('Every row needs a contractor and an amount.');
    if (totals.invalid.size) return setError(`Use plain amounts with at most ${asset.decimals} decimal places, such as 1250.50.`);
    setSaving(true);
    try {
      await onSave({ title, items: items.map((r) => ({ contractorId: r.contractorId, amount: r.amount.trim() })) });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (contractors.data && contractors.data.length === 0) {
    return <Empty title="Add contractors first" body="A batch pays existing contractors. Add the people you pay and their payout wallets, then come back." />;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Field label="Batch name" htmlFor="title" hint="People approving will see this name.">
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </Field>

      <div className="rounded-panel border border-line bg-surface">
        <div className="grid grid-cols-[1fr_11rem_2.5rem] gap-3 border-b border-line px-5 py-2.5 text-[12.5px] font-medium text-ink-faint">
          <span>Contractor</span>
          <span>Amount ({asset.symbol})</span>
          <span className="sr-only">Remove</span>
        </div>
        <ul>
          {rows.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[1fr_11rem_2.5rem] items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0">
              <Select value={r.contractorId} onChange={(e) => update(r.key, { contractorId: e.target.value })} aria-label={`Contractor for row ${i + 1}`}>
                <option value="">Choose a contractor</option>
                {contractors.data?.map((c) => (
                  <option key={c.id} value={c.id} disabled={used.has(c.id) && c.id !== r.contractorId}>
                    {c.name}
                    {c.country ? ` (${c.country})` : ''}
                  </option>
                ))}
              </Select>
              <Input
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => update(r.key, { amount: e.target.value })}
                placeholder="0.00"
                aria-label={`Amount for row ${i + 1}`}
                aria-invalid={totals.invalid.has(r.key)}
                className={`text-right ${totals.invalid.has(r.key) ? 'border-fail' : ''}`}
              />
              <button
                type="button"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [{ key: nextKey++, contractorId: '', amount: '' }]))}
                className="flex size-9 items-center justify-center rounded-control text-ink-faint hover:bg-wash hover:text-fail"
                aria-label={`Remove row ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-wash/60 px-5 py-3">
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setRows((rs) => [...rs, { key: nextKey++, contractorId: '', amount: '' }])}>
              Add row
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={addEveryone}>
              Add every contractor
            </Button>
          </div>
          <p className="text-sm">
            Total <span className="ml-2 text-lg font-semibold">{amount(totals.total, asset)}</span>
          </p>
        </div>
      </div>

      {error && <Notice tone="fail">{error}</Notice>}
      <div>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function defaultTitle() {
  return `${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date())} contractors`;
}
