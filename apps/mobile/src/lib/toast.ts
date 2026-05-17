import { useEffect, useState } from 'react';

// Tiny global toast bus. Lets any module fire a short-lived toast that
// the home screen renders. Kept minimal — no queue, no positioning
// options; the single visible toast either persists for `durationMs` or
// is replaced by the next.

type Toast = { id: number; text: string; durationMs: number };
let currentId = 0;
const subscribers = new Set<(t: Toast | null) => void>();

export function showToast(text: string, durationMs = 2500): void {
  const toast: Toast = { id: ++currentId, text, durationMs };
  for (const sub of subscribers) sub(toast);
}

export function useToast(): Toast | null {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    const sub = (t: Toast | null) => setToast(t);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);
  // Auto-clear when the duration expires.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast((curr) => (curr?.id === toast.id ? null : curr));
    }, toast.durationMs);
    return () => clearTimeout(t);
  }, [toast]);
  return toast;
}
