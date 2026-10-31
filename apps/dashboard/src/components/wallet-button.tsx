'use client';

import { ChevronDown, LogOut, Wallet } from 'lucide-react';
import { useState } from 'react';
import { shortHash } from '@/lib/format';
import { sameAddress } from '@/lib/wallet';
import { PopoverPanel, usePopover } from './popover';
import { useWallet } from './providers';
import { Button, Dialog, Hash, Notice } from './ui';

export function WalletPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { options, connect, connecting, error } = useWallet();
  return (
    <Dialog open={open} onClose={onClose} title="Connect a Starknet wallet">
      <p className="text-sm text-ink-soft">Your wallet shows every transaction before you sign. Veyra never holds your keys.</p>
      <div className="mt-5 flex flex-col gap-2">
        {options.length === 0 && <Notice>No Starknet wallet found in this browser. Install Ready or Braavos, then reload the page.</Notice>}
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

/** Top-bar wallet control: connect button, or a chip with a details popover. */
export function WalletButton({ expected }: { expected?: string | null }) {
  const { wallet, disconnect } = useWallet();
  const [picker, setPicker] = useState(false);
  const { open, setOpen, ref } = usePopover();

  if (!wallet) {
    return (
      <>
        <Button variant="secondary" size="sm" icon={<Wallet className="size-4" />} onClick={() => setPicker(true)} className="h-9">
          Connect wallet
        </Button>
        <WalletPicker open={picker} onClose={() => setPicker(false)} />
      </>
    );
  }
  const mismatch = !!expected && !sameAddress(expected, wallet.address);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-3 text-[13px] hover:border-line-strong"
      >
        {wallet.icon ? <img src={wallet.icon} alt="" className="size-6 rounded-full" /> : <span className="flex size-6 items-center justify-center rounded-full bg-wash"><Wallet className="size-3.5" /></span>}
        <span className="font-mono">{shortHash(wallet.address)}</span>
        <span className={`size-1.5 rounded-full ${mismatch ? 'bg-pending' : 'bg-settle'}`} aria-hidden />
        <ChevronDown className="size-3.5 text-ink-faint" aria-hidden />
      </button>
      {open && (
        <PopoverPanel className="right-0 top-11 w-80">
          <div className="p-4">
            <p className="text-[12.5px] text-ink-faint">Connected with {wallet.name}</p>
            <Hash value={wallet.address} className="mt-2" />
            {mismatch ? (
              <p className="mt-3 text-[13px] text-pending">This is not the wallet linked to your membership. On-chain approvals from it will not count.</p>
            ) : expected ? (
              <p className="mt-3 text-[13px] text-settle-strong">Linked to your membership.</p>
            ) : (
              <p className="mt-3 text-[13px] text-ink-soft">Link it on the Team page to approve on-chain.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm text-ink-soft hover:bg-wash hover:text-ink"
          >
            <LogOut className="size-4" /> Disconnect wallet
          </button>
        </PopoverPanel>
      )}
    </div>
  );
}
