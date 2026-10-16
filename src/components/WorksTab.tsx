import { useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { exportWorksCsv, getFacets, searchWorks } from "@/lib/api";
import { DEFAULT_FILTERS, toRequest, type Filters } from "@/lib/filters";
import type { Copy } from "@/lib/i18n";
import { inr, shortType } from "@/lib/format";
import { Card, ErrorNote, SeverityPill, inputCls, useAsync, useDebounced } from "./ui";

const PAGE_SIZE = 25;

export function WorksTab({ t, filters, setFilters, onOpen }: { t: Copy; filters: Filters; setFilters: (f: Filters) => void; onOpen: (code: string) => void }) {
  const [qLocal, setQLocal] = useState(filters.q);
  const debouncedQ = useDebounced(qLocal, 300);
  const effective: Filters = { ...filters, q: debouncedQ };
  const facets = useAsync(() => getFacets(), []);
  const key = JSON.stringify(effective);
  const res = useAsync(() => searchWorks({ data: toRequest(effective, PAGE_SIZE) }), [key]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const patch = (p: Partial<Filters>) => setFilters({ ...filters, ...p, page: p.page ?? 0 });
  const setSort = (sort: Filters["sort"]) => patch({ sort, dir: filters.sort === sort && filters.dir === "desc" ? "asc" : "desc" });
  const f = facets.data;

  async function download() {
    setExporting(true); setExportError(null);
    try {
      const out = await exportWorksCsv({ data: toRequest(effective, PAGE_SIZE) });
      const url = URL.createObjectURL(new Blob(["\ufeff" + out.csv], { type: "text/csv;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `mplad-works-${new Date().toISOString().slice(0, 10)}.csv` });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setExportError(e instanceof Error ? e.message : "Export failed"); } finally { setExporting(false); }
  }

  const data = res.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const sortMark = (s: Filters["sort"]) => (filters.sort === s ? (filters.dir === "desc" ? " ↓" : " ↑") : "");

  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-2 md:grid-cols-4">
          <input className={`${inputCls} md:col-span-2`} placeholder={t.filters.search} value={qLocal} onChange={(e) => { setQLocal(e.target.value); setFilters({ ...filters, q: e.target.value, page: 0 }); }} />
          <select className={inputCls} value={filters.state} onChange={(e) => patch({ state: e.target.value })}>
            <option value="">{t.filters.allStates}</option>
            {f?.states.map((s) => <option key={s.value} value={s.value}>{s.value} ({s.count})</option>)}
          </select>
          <select className={inputCls} value={filters.fy} onChange={(e) => patch({ fy: e.target.value })}>
            <option value="">{t.filters.allFy}</option>
            {f?.fys.map((s) => <option key={s.value} value={s.value}>{s.value} ({s.count})</option>)}
          </select>
          <select className={`${inputCls} md:col-span-2`} value={filters.workType} onChange={(e) => patch({ workType: e.target.value })}>
            <option value="">{t.filters.allTypes}</option>
            {f?.workTypes.map((s) => <option key={s.value} value={s.value}>{shortType(s.value, 60)} ({s.count})</option>)}
          </select>
          <select className={inputCls} value={filters.severity} onChange={(e) => patch({ severity: e.target.value })}>
            <option value="">{t.filters.allSev}</option>
            <option value="flagged">{t.filters.flagged}</option>
            {(["critical", "high", "watch", "clear"] as const).map((s) => <option key={s} value={s}>{t.x.sev[s]}</option>)}
          </select>
          <select className={inputCls} value={filters.flag} onChange={(e) => patch({ flag: e.target.value })}>
            <option value="">{t.filters.anyFlag}</option>
            {f?.flags.map((s) => <option key={s.code} value={s.code}>{t.x.flags[s.code] ?? s.code} ({s.count})</option>)}
          </select>
          <select className={inputCls} value={filters.photo} onChange={(e) => patch({ photo: e.target.value as Filters["photo"] })}>
            <option value="">{t.filters.anyPhoto}</option>
            <option value="yes">{t.filters.photoYes}</option>
            <option value="no">{t.filters.photoNo}</option>
          </select>
          <input className={inputCls} inputMode="numeric" placeholder={t.filters.minAmt} value={filters.minAmount} onChange={(e) => patch({ minAmount: e.target.value.replace(/[^\d]/g, "") })} />
          <div className="flex gap-2 md:col-span-2">
            <button className={`${inputCls} flex items-center gap-2`} onClick={() => { setQLocal(""); setFilters(DEFAULT_FILTERS); }}><RotateCcw size={14} />{t.filters.reset}</button>
            <button className={`${inputCls} flex items-center gap-2`} onClick={download} disabled={exporting}><Download size={14} />{t.filters.export}</button>
          </div>
        </div>
        {filters.mpKey && (
          <p className="mt-2 text-xs text-muted">{t.x.memberFilter} · <button className="underline" onClick={() => patch({ mpKey: "" })}>{t.x.clear}</button></p>
        )}
        {exportError && <div className="mt-2"><ErrorNote message={exportError} /></div>}
      </Card>

      {res.error && <ErrorNote message={res.error} />}
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>{data ? `${data.total.toLocaleString("en-IN")} ${t.x.works} · ${inr(data.amount)} · ${data.flagged.toLocaleString("en-IN")} ${t.x.flagged}` : t.loading}</span>
          <span className="flex items-center gap-2">
            <button className={inputCls} disabled={filters.page <= 0} onClick={() => patch({ page: filters.page - 1 })}>{t.prev}</button>
            <span>{filters.page + 1} / {pages}</span>
            <button className={inputCls} disabled={filters.page + 1 >= pages} onClick={() => patch({ page: filters.page + 1 })}>{t.next}</button>
          </span>
        </div>
        <ul className="grid gap-2 md:hidden">
          {data?.rows.map((w) => (
            <li key={w.workCode} className="cursor-pointer rounded-lg border border-line bg-surface-2 p-3" onClick={() => onOpen(w.workCode)}>
              <div className="flex items-start justify-between gap-2"><span className="font-medium">{w.workType}</span><SeverityPill severity={w.severity} risk={w.risk} label={t.x.sev[w.severity]} /></div>
              <p className="mt-1 text-xs text-muted">{w.workCode}</p>
              <p className="mt-1 text-sm">{w.mpName} · {w.state}</p>
              <p className="text-sm text-muted">{w.completionDate} · {inr(w.amount)}</p>
              {w.flagCodes.length > 0 && <p className="mt-1 text-xs text-gold">{w.flagCodes.map((c) => t.x.flags[c] ?? c).join(", ")}</p>}
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-muted uppercase">
              <tr>
                <th className="py-2 pr-3">{t.cols.work}</th><th className="pr-3">{t.cols.state}</th><th className="pr-3">{t.cols.member}</th>
                <th className="pr-3"><button onClick={() => setSort("date")}>{t.cols.date}{sortMark("date")}</button></th>
                <th className="pr-3 text-right"><button onClick={() => setSort("amount")}>{t.cols.amount}{sortMark("amount")}</button></th>
                <th className="pr-3"><button onClick={() => setSort("risk")}>{t.cols.risk}{sortMark("risk")}</button></th>
                <th>{t.cols.indicators}</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((w) => (
                <tr key={w.workCode} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => onOpen(w.workCode)}>
                  <td className="max-w-[340px] py-2 pr-3">
                    <div className="truncate font-medium" title={w.workType}>{w.workType}</div>
                    <div className="truncate text-xs text-muted" title={w.description ?? ""}>{w.workCode}{w.description ? ` · ${w.description}` : ""}</div>
                  </td>
                  <td className="pr-3">{w.state}</td>
                  <td className="pr-3">{w.mpName}<div className="text-xs text-muted">{w.constituency ?? w.chamber}</div></td>
                  <td className="pr-3 whitespace-nowrap">{w.completionDate}</td>
                  <td className="pr-3 text-right whitespace-nowrap">{inr(w.amount)}</td>
                  <td className="pr-3"><SeverityPill severity={w.severity} risk={w.risk} label={t.x.sev[w.severity]} /></td>
                  <td className="text-xs text-muted">{w.flagCodes.map((c) => t.x.flags[c] ?? c).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.rows.length === 0 && <p className="py-8 text-center text-muted">{t.empty}</p>}
        </div>
      </Card>
    </div>
  );
}
