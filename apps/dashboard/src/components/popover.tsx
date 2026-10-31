'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Click-to-open panel that closes on outside click and Escape. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function PopoverPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute z-50 overflow-hidden rounded-panel border border-line bg-surface shadow-[0_18px_48px_-20px_rgba(19,32,27,0.45)] ${className}`}
    >
      {children}
    </div>
  );
}
