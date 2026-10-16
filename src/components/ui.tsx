import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { tone, type Severity } from "@/lib/format";

export function Card({ title, children, className = "", action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-line bg-surface p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SeverityPill({ severity, risk, label }: { severity: Severity; risk?: number; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${tone[severity]}`}>
      {label ?? severity}
      {risk !== undefined && <span className="opacity-80">{risk}</span>}
    </span>
  );
}

export const inputCls =
  "h-9 rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-gold disabled:opacity-60";

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Runs an async loader whenever deps change; ignores stale responses. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader().then(
      (data) => { if (id === seq.current) setState({ data, error: null, loading: false }); },
      (e) => { if (id === seq.current) setState({ data: null, error: e instanceof Error ? e.message : "Request failed", loading: false }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{message}</p>;
}
