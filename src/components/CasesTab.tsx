import { listCases } from "@/lib/api";
import type { Copy } from "@/lib/i18n";
import { inr } from "@/lib/format";
import { Card, ErrorNote, SeverityPill, useAsync } from "./ui";
import type { Severity } from "@/lib/format";

export function CasesTab({ t, onOpen, refreshKey }: { t: Copy; onOpen: (code: string) => void; refreshKey: number }) {
  const { data, error, loading } = useAsync(() => listCases(), [refreshKey]);
  return (
    <Card title={t.cases.title}>
      {error && <ErrorNote message={error} />}
      {loading && !data && <p className="text-muted">{t.loading}</p>}
      {data && data.length === 0 && <p className="text-muted">{t.cases.none}</p>}
      <ul className="divide-y divide-line">
        {data?.map((c) => (
          <li key={c.workCode} className="cursor-pointer py-3 hover:bg-surface-2" onClick={() => onOpen(c.workCode)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{c.workType ?? c.workCode}</span>
              <span className="flex items-center gap-2 text-sm">
                {c.severity && <SeverityPill severity={c.severity as Severity} risk={c.risk ?? undefined} label={t.x.sev[c.severity as Severity]} />}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{c.status === "reviewed" ? t.detail.reviewed : c.status === "dismissed" ? t.detail.dismissed : t.detail.open}</span>
              </span>
            </div>
            <p className="text-xs text-muted">{c.workCode} · {c.state} · {inr(c.amount)} · {new Date(c.updatedAt).toLocaleString()}</p>
            {c.note && <p className="mt-1 line-clamp-2 text-sm">{c.note}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
