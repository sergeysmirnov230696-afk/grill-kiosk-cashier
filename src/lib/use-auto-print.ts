import { useEffect } from "react";

/**
 * Автоматически запускает печать чека, как только он появился на экране.
 * Работает с принтером, подключённым к планшету/ПК по USB или Bluetooth:
 * печать уходит на принтер по умолчанию в системе.
 */
export function useAutoPrint(ready: boolean, enabled: boolean, copies = 1) {
  useEffect(() => {
    if (!ready || !enabled) return;
    let cancelled = false;
    const timers: number[] = [];
    for (let i = 0; i < Math.max(1, copies); i++) {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) window.print();
        }, 300 + i * 1200),
      );
    }
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [ready, enabled, copies]);
}
