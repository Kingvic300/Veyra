'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { discoverWallets, onWalletsChanged, type ConnectedWallet, type WalletOption } from '@/lib/wallet';
import { VeyraApiError } from '@/lib/api';
import { NotificationsProvider, SESSION_EXPIRED_EVENT, SIGNED_IN_FLAG, useNotify, type NoticeTone } from './notifications';

export { useNotify } from './notifications';

// ---- Wallet ----------------------------------------------------------------

interface WalletState {
  wallet: ConnectedWallet | null;
  options: WalletOption[];
  connecting: boolean;
  connect: (option: WalletOption) => Promise<ConnectedWallet | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);
const LAST_WALLET = 'veyra:last-wallet';

function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const scan = () => setOptions(discoverWallets());
    scan();
    // Some extensions inject after load.
    const t = setTimeout(scan, 800);
    const off = onWalletsChanged(scan);
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  const connect = useCallback(async (option: WalletOption) => {
    setConnecting(true);
    try {
      const w = await option.connect();
      setWallet(w);
      localStorage.setItem(LAST_WALLET, option.id);
      return w;
    } catch (err) {
      toast('fail', err instanceof Error ? err.message : 'The wallet refused the connection');
      return null;
    } finally {
      setConnecting(false);
    }
  }, [toast]);

  const disconnect = useCallback(() => {
    setWallet(null);
    localStorage.removeItem(LAST_WALLET);
  }, []);

  const value = useMemo(() => ({ wallet, options, connecting, connect, disconnect }), [wallet, options, connecting, connect, disconnect]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet outside WalletProvider');
  return ctx;
}

// ---- Toasts (compatibility wrapper over the notifications system) -------------

type LegacyTone = 'settle' | 'fail' | 'neutral';
const TONE_MAP: Record<LegacyTone, NoticeTone> = { settle: 'success', fail: 'error', neutral: 'info' };

/** Short helper: toast(tone, title, description?). */
export function useToast() {
  const { toast } = useNotify();
  return useCallback(
    (tone: LegacyTone, title: string, description?: string) => toast({ tone: TONE_MAP[tone], title, description }),
    [toast],
  );
}

// ---- Root --------------------------------------------------------------------

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err) => {
            if (err instanceof VeyraApiError && err.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
          },
          onSuccess: (_data, query) => {
            if (query.queryKey[0] === 'me') sessionStorage.setItem(SIGNED_IN_FLAG, '1');
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: (count, err) => !(err instanceof VeyraApiError && err.status < 500) && count < 2,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <NotificationsProvider>
        <WalletProvider>{children}</WalletProvider>
      </NotificationsProvider>
    </QueryClientProvider>
  );
}
