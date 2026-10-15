import { useState } from "react";
import { getFacets, listMembers } from "@/lib/api";
import type { Copy } from "@/lib/i18n";
import { inr } from "@/lib/format";
import { Card, ErrorNote, inputCls, useAsync, useDebounced } from "./ui";

const PAGE_SIZE = 25;

export function MembersTab({ t, onViewWorks }: { t: Copy; onViewWorks: (mpKey: string) => void }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState<"disbursed" | "works" | "flagged" | "allocated">("disbursed");
  const [page, setPage] = useState(0);
  const dq = useDebounced(q, 300);
  const facets = useAsync(() => getFacets(), []);
  const res = useAsync(() => listMembers({ data: { q: dq, state, sort, page, pageSize: PAGE_SIZE } }), [dq, state, sort, page]);
  const data = res.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const th = (label: string, s: typeof sort) => <button className={sort === s ? "text-gold" : ""} onClick={() => { setSort(s); setPage(0); }}>{label}</button>;
  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-2 md:grid-cols-3">
          <input className={inputCls} placeholder={t.members.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <select className={inputCls} value={state} onChange={(e) => { setState(e.target.value); setPage(0); }}>
            <option value="">{t.filters.allStates}</option>
            {facets.data?.states.map((s) => <option key={s.value} value={s.value}>{s.value}</option>)}
          </select>
        </div>
      </Card>
      {res.error && <ErrorNote message={res.error} />}
      <Card>
        <div className="mb-2 flex items-center justify-between text-sm text-muted">
          <span>{data ? `${data.total} members` : t.loading}</span>
          <span className="flex items-center gap-2">
            <button className={inputCls} disabled={page <= 0} onClick={() => setPage(page - 1)}>{t.prev}</button>
            <span>{page + 1} / {pages}</span>
            <button className={inputCls} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{t.next}</button>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted uppercase">
              <tr><th className="py-2 pr-3">{t.members.name}</th><th className="pr-3">{th(t.members.works, "works")}</th><th className="pr-3 text-right">{th(t.members.disbursed, "disbursed")}</th><th className="pr-3 text-right">{th(t.members.allocated, "allocated")}</th><th className="pr-3">{t.members.photo}</th><th className="pr-3">{th(t.members.flagged, "flagged")}</th><th /></tr>
            </thead>
            <tbody>
              {data?.rows.map((m) => (
                <tr key={`${m.mpKey}|${m.state}`} className="border-t border-line">
                  <td className="py-2 pr-3"><div className="font-medium">{m.name}</div><div className="text-xs text-muted">{m.constituency ?? m.chamber} · {m.state}</div></td>
                  <td className="pr-3">{m.works.toLocaleString("en-IN")}</td>
                  <td className="pr-3 text-right whitespace-nowrap">{inr(m.disbursed)}</td>
                  <td className="pr-3 text-right whitespace-nowrap text-muted">{inr(m.allocated)}</td>
                  <td className="pr-3">{m.works ? Math.round((m.withPhoto / m.works) * 100) : 0}%</td>
                  <td className="pr-3">{m.flagged}</td>
                  <td><button className="text-gold underline" onClick={() => onViewWorks(m.mpKey)}>{t.members.view}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Allocation is the amount listed in the official allocation export (term-wide). It is shown for context and is not directly comparable with works completed in 2024–26.</p>
      </Card>
    </div>
  );
}
