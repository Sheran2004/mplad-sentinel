import { Bar, BarChart, CartesianGrid, Cell, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getOverview } from "@/lib/api";
import type { Copy } from "@/lib/i18n";
import { inr, shortType } from "@/lib/format";
import { Card, ErrorNote, useAsync } from "./ui";

const SEV_COLOR: Record<string, string> = { critical: "var(--color-danger)", high: "var(--color-warn)", watch: "var(--color-gold)", clear: "var(--color-ok)" };

export function OverviewTab({ t, onOpenState, onOpenSeverity }: { t: Copy; onOpenState: (s: string) => void; onOpenSeverity: (s: string) => void }) {
  const { data, error, loading } = useAsync(() => getOverview(), []);
  if (error) return <ErrorNote message={error} />;
  if (loading || !data) return <p className="text-muted">{t.loading}</p>;
  const k = data.totals;
  const kpis = [
    [t.kpi.works, k.works.toLocaleString("en-IN")],
    [t.kpi.amount, inr(k.amount)],
    [t.kpi.flagged, `${k.flagged.toLocaleString("en-IN")} (${((k.flagged / k.works) * 100).toFixed(1)}%)`],
    [t.kpi.photo, `${((k.withPhoto / k.works) * 100).toFixed(1)}%`],
    [t.kpi.states, String(k.states)],
    [t.kpi.members, String(k.members)],
  ];
  const sev = ["critical", "high", "watch", "clear"].map((s) => ({ name: s, value: data.severity[s] ?? 0 }));
  const axis = { stroke: "var(--color-muted)", fontSize: 11 } as const;
  const tip = { contentStyle: { background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 8, color: "var(--color-fg)" } };
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className="font-display mt-1 text-xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted">
        {k.firstDate} → {k.lastDate} · {t.note}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t.charts.monthly}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.byMonth.map((m) => ({ ...m, cr: m.amount / 1e7 }))}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="month" {...axis} minTickGap={24} />
                <YAxis {...axis} unit=" cr" width={56} />
                <Tooltip {...tip} formatter={(v: number) => [`₹${v.toFixed(1)} cr`, "Disbursed"]} />
                <Area dataKey="cr" stroke="var(--color-gold)" fill="var(--color-gold)" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t.charts.severity}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sev} onClick={(e) => { const n = e?.activeLabel; if (n && n !== "clear") onOpenSeverity(String(n)); }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} width={56} />
                <Tooltip {...tip} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {sev.map((s) => <Cell key={s.name} fill={SEV_COLOR[s.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t.charts.states}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byState.map((s) => ({ ...s, cr: s.amount / 1e7 }))} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis type="number" {...axis} unit=" cr" />
                <YAxis type="category" dataKey="state" {...axis} width={110} />
                <Tooltip {...tip} formatter={(v: number) => [`₹${v.toFixed(1)} cr`, "Disbursed"]} />
                <Bar dataKey="cr" fill="var(--color-gold)" radius={[0, 6, 6, 0]} onClick={(d) => onOpenState((d as unknown as { state: string }).state)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t.charts.types}>
          <ul className="space-y-2 text-sm">
            {data.byType.map((w) => (
              <li key={w.workType}>
                <div className="flex justify-between gap-3"><span title={w.workType}>{shortType(w.workType, 62)}</span><span className="shrink-0 text-muted">{inr(w.amount)}</span></div>
                <div className="mt-1 h-1.5 rounded bg-surface-2"><div className="h-1.5 rounded bg-gold" style={{ width: `${(w.amount / data.byType[0].amount) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
