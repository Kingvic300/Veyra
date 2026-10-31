'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { discoverWallets, onWalletsChanged, type ConnectedWallet, type WalletOption } from '@/lib/wallet';
import { VeyraApiError } from '@/lib/api';

// ---- Wallet ----------------------------------------------------------------

interface WalletState {
  wallet: ConnectedWallet | null;
  options: WalletOption[];
  connecting: boolean;
  error: string | null;
  connect: (option: WalletOption) => Promise<ConnectedWallet | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);
const LAST_WALLET = 'veyra:last-wallet';

function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const w = await option.connect();
      setWallet(w);
      localStorage.setItem(LAST_WALLET, option.id);
      return w;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The wallet refused the connection');
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    localStorage.removeItem(LAST_WALLET);
  }, []);

  const value = useMemo(() => ({ wallet, options, connecting, error, connect, disconnect }), [wallet, options, connecting, error, connect, disconnect]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet outside WalletProvider');
  return ctx;
}

// ---- Toasts ------------------------------------------------------------------

interface Toast {
  id: number;
  tone: 'settle' | 'fail' | 'neutral';
  text: string;
}
const ToastContext = createContext<(tone: Toast['tone'], text: string) => void>(() => {});

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'pointer-events-auto max-w-sm rounded-control border px-4 py-3 text-sm shadow-[0_6px_24px_-12px_rgba(19,32,27,0.35)] ' +
              (t.tone === 'fail'
                ? 'border-fail/30 bg-surface text-fail'
                : t.tone === 'settle'
                  ? 'border-settle/30 bg-surface text-settle-strong'
                  : 'border-line bg-surface text-ink')
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ---- Root --------------------------------------------------------------------

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
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
      <ToastProvider>
        <WalletProvider>{children}</WalletProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
