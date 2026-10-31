'use client';

import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { shortHash } from '@/lib/format';
import { useWallet } from './providers';
import { Button, Dialog, Notice } from './ui';

export function WalletPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { options, connect, connecting, error } = useWallet();
  return (
    <Dialog open={open} onClose={onClose} title="Connect a Starknet wallet">
      <p className="text-sm text-ink-soft">Your wallet shows every transaction before you sign. Veyra never holds your keys.</p>
      <div className="mt-5 flex flex-col gap-2">
        {options.length === 0 && (
          <Notice>
            No Starknet wallet found in this browser. Install Ready or Braavos, then reload the page.
          </Notice>
        )}
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={connecting}
            onClick={async () => {
              if (await connect(o)) onClose();
            }}
            className="flex items-center gap-3 rounded-control border border-line px-4 py-3 text-left hover:border-settle hover:bg-settle-wash/40 disabled:opacity-60"
          >
            {o.icon ? <img src={o.icon} alt="" className="size-7 rounded-md" /> : <Wallet className="size-6 text-ink-soft" />}
            <span className="flex-1 font-medium">{o.name}</span>
            {o.standard && <span className="text-[12px] text-ink-faint">Wallet Standard</span>}
          </button>
        ))}
        {error && <Notice tone="fail">{error}</Notice>}
      </div>
    </Dialog>
  );
}

export function WalletButton({ expected }: { expected?: string | null }) {
  const { wallet, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  if (!wallet) {
    return (
      <>
        <Button variant="secondary" size="sm" icon={<Wallet className="size-4" />} onClick={() => setOpen(true)} className="w-full">
          Connect wallet
        </Button>
        <WalletPicker open={open} onClose={() => setOpen(false)} />
      </>
    );
  }
  const mismatch = expected && BigInt(expected) !== BigInt(wallet.address);
  return (
    <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-2">
      <span className={`size-2 rounded-full ${mismatch ? 'bg-pending' : 'bg-settle'}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12.5px]" title={wallet.address}>
          {shortHash(wallet.address)}
        </span>
        <span className="block text-[11.5px] text-ink-faint">{mismatch ? 'Not your linked wallet' : wallet.name}</span>
      </span>
      <button type="button" onClick={disconnect} className="text-[12px] text-ink-faint hover:text-ink">
        Disconnect
      </button>
    </div>
  );
}
