import { getAccessInfo, getOverview } from "@/lib/api";
import { RULES, SEVERITY_CUTOFFS } from "@/lib/dataset/analyze";
import type { QualityReport } from "@/lib/dataset/types";
import type { Copy } from "@/lib/i18n";
import { Card, ErrorNote, useAsync } from "./ui";

const n = (x: number) => x.toLocaleString("en-IN");

export function MethodTab({ t }: { t: Copy }) {
  const ov = useAsync(() => getOverview(), []);
  const access = useAsync(() => getAccessInfo(), []);
  if (ov.error) return <ErrorNote message={ov.error} />;
  const q = ov.data?.quality as QualityReport | null | undefined;
  const rules: [string, string][] = [
    ["Amount outlier", `Amount vs the median of works with the same work type (types with ≥ ${RULES.amountOutlier.minPeers} works). Fires when the robust z-score on log amount ≥ ${RULES.amountOutlier.modifiedZ} and the amount is ≥ ${RULES.amountOutlier.minRatioToMedian}× the median. +10 / +18 / +26 by strength.`],
    ["Possible duplicate", `Same implementing authority and identical description (≥ ${RULES.duplicate.minDescriptionChars} characters), amounts within ${RULES.duplicate.amountTolerance * 100}%. +${RULES.duplicate.base}, +${RULES.duplicate.exactAmountBonus} if the amount is identical, +${RULES.duplicate.sameDateBonus} if the completion date is identical.`],
    ["Same-day batch", `${RULES.sameDayBatch.minWorksPerMemberDay}+ works of one member share a completion date. +${RULES.sameDayBatch.points}. Usually batch data entry, so dates may be unreliable.`],
    ["High value, no photo", "₹10 lakh+ (+8) or ₹25 lakh+ (+12) disbursed with no completion photo on the dashboard."],
    ["Missing amount / description", `Row has no amount (+${RULES.missingAmount}) or no description (+${RULES.missingDescription}), so it cannot be checked.`],
    ["Date inconsistent", `Completion date before the financial year in the work code, or after the data retrieval date (+${RULES.dateIntegrity}).`],
  ];
  return (
    <div className="grid gap-4">
      <Card title="Source">
        {q ? (
          <div className="grid gap-1 text-sm">
            <p>{q.generatedFrom.source} — retrieved {q.generatedFrom.retrievedDate}.</p>
            <p><a className="text-gold underline" href={q.generatedFrom.sourceUrl} target="_blank" rel="noreferrer noopener">{q.generatedFrom.sourceUrl}</a></p>
            <p className="text-muted">{q.generatedFrom.notice}</p>
            <p>Database: {access.data?.database ?? "…"} · AI desk: {access.data ? (access.data.aiConfigured ? "configured" : "GROQ_API_KEY missing") : "…"}</p>
          </div>
        ) : <p className="text-muted">{t.loading}</p>}
      </Card>
      {q && (
        <Card title="Data quality">
          <ul className="grid gap-2 text-sm">
            {q.findings.map((f, i) => <li key={i} className="rounded-lg border border-warn/40 bg-warn/10 p-3">{f}</li>)}
            <li>Rows: Lok Sabha export {n(q.rows.lokSabhaExport)} · Rajya Sabha export {n(q.rows.rajyaSabhaExport)} · unique works {n(q.rows.unionUnique)} · unparsed {q.rows.unparsedWorkCodes}</li>
            <li>Attribution by member match: Lok Sabha {n(q.attribution.lokSabha)} · Rajya Sabha {n(q.attribution.rajyaSabha)} · unknown {n(q.attribution.unknown)}</li>
            <li>Missing: amount {n(q.missing.amount)} · description {n(q.missing.description)} · photo {n(q.missing.image)} · constituency {n(q.missing.constituency)}</li>
            <li>Date checks: before financial year {q.dateIssues.beforeFinancialYear} · after retrieval {q.dateIssues.afterRetrieval}</li>
          </ul>
        </Card>
      )}
      <Card title="Screening rules">
        <ul className="grid gap-3 text-sm">
          {rules.map(([k, v]) => <li key={k}><span className="font-medium">{k}.</span> <span className="text-muted">{v}</span></li>)}
        </ul>
        <p className="mt-3 text-sm text-muted">Risk = sum of points, capped at 100. Severity: {SEVERITY_CUTOFFS.filter((s) => s.severity !== "clear").map((s) => `${s.severity} ≥ ${s.min}`).join(", ")}.</p>
      </Card>
      <Card title="What this tool cannot see">
        <p className="text-sm text-muted">The official export has no vendor, sanctioned amount, physical progress, geo-tag or bill data. Rules that need those fields (spend vs progress, vendor concentration, location checks) are intentionally not simulated. A flag means “worth a closer look”; confirm against sanction orders, measurement books, bills and a site visit before drawing any conclusion.</p>
      </Card>
    </div>
  );
}
