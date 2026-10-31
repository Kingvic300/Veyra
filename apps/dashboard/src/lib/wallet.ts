'use client';

import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import type { ChainCall } from '@veyra/chain-adapter';

/**
 * Starknet wallet access. Discovers Wallet Standard wallets (Ready, Braavos and
 * others) and falls back to legacy injected `window.starknet*` objects. Veyra
 * never sees a private key: the wallet shows each call and signs it.
 */

type RequestFn = (call: { type: string; params?: unknown }) => Promise<unknown>;

export interface WalletOption {
  id: string;
  name: string;
  icon: string | null;
  /** Wallet Standard wallets can run STRK20 private actions. */
  standard: boolean;
  connect: () => Promise<ConnectedWallet>;
}

export interface ConnectedWallet {
  id: string;
  name: string;
  icon: string | null;
  address: string;
  chainId: string | null;
  /** Send an invoke transaction; resolves with the transaction hash. */
  execute: (calls: ChainCall[]) => Promise<string>;
  /** STRK20 private actions (experimental). Null when the wallet cannot. */
  strk20: ((actions: unknown[]) => Promise<string>) | null;
}

const WALLET_API = 'starknet:walletApi';

function toWalletCalls(calls: ChainCall[]) {
  return calls.map((c) => ({ contract_address: c.contractAddress, entry_point: c.entrypoint, calldata: c.calldata }));
}

function txHash(result: unknown): string {
  const hash = (result as { transaction_hash?: string })?.transaction_hash;
  if (!hash) throw new Error('The wallet did not return a transaction hash');
  return hash;
}

async function connectWithRequest(id: string, name: string, icon: string | null, request: RequestFn, standard: Wallet | null) {
  const accounts = (await request({ type: 'wallet_requestAccounts' })) as string[];
  const address = accounts[0];
  if (!address) throw new Error('No account was shared by the wallet');
  const chainId = (await request({ type: 'wallet_requestChainId' }).catch(() => null)) as string | null;
  const wallet: ConnectedWallet = {
    id,
    name,
    icon,
    address,
    chainId,
    execute: async (calls) => txHash(await request({ type: 'wallet_addInvokeTransaction', params: { calls: toWalletCalls(calls) } })),
    strk20: null,
  };
  if (standard) {
    wallet.strk20 = async (actions) => {
      // Loaded lazily: only experimental STRK20 organisations need it.
      const { walletV6 } = await import('starknet');
      const result = await walletV6.strk20InvokeTransaction(
        standard as Parameters<typeof walletV6.strk20InvokeTransaction>[0],
        actions as Parameters<typeof walletV6.strk20InvokeTransaction>[1],
      );
      return txHash(result);
    };
  }
  return wallet;
}

export function discoverWallets(): WalletOption[] {
  if (typeof window === 'undefined') return [];
  const options: WalletOption[] = [];
  const seen = new Set<string>();

  for (const w of getWallets().get()) {
    const feature = (w.features as Record<string, { request?: RequestFn } | undefined>)[WALLET_API];
    if (!feature?.request) continue;
    const request = feature.request.bind(feature);
    seen.add(w.name.toLowerCase());
    options.push({
      id: `std:${w.name}`,
      name: w.name,
      icon: w.icon ?? null,
      standard: true,
      connect: async () => {
        const connectFeature = (w.features as Record<string, { connect?: () => Promise<unknown> } | undefined>)['standard:connect'];
        await connectFeature?.connect?.();
        return connectWithRequest(`std:${w.name}`, w.name, w.icon ?? null, request, w);
      },
    });
  }

  const injected = window as unknown as Record<string, unknown>;
  for (const key of Object.keys(injected)) {
    if (!key.startsWith('starknet')) continue;
    const obj = injected[key] as { id?: string; name?: string; icon?: string; request?: RequestFn } | undefined;
    if (!obj || typeof obj.request !== 'function' || !obj.name) continue;
    if (seen.has(obj.name.toLowerCase())) continue;
    seen.add(obj.name.toLowerCase());
    const request = obj.request.bind(obj);
    options.push({
      id: `legacy:${obj.id ?? key}`,
      name: obj.name,
      icon: typeof obj.icon === 'string' ? obj.icon : null,
      standard: false,
      connect: () => connectWithRequest(`legacy:${obj.id ?? key}`, obj.name!, obj.icon ?? null, request, null),
    });
  }
  return options;
}

/** Re-scan when a Wallet Standard wallet registers late. */
export function onWalletsChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const { on } = getWallets();
  const off1 = on('register', listener);
  const off2 = on('unregister', listener);
  return () => {
    off1();
    off2();
  };
}

export function sameAddress(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}
