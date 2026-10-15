import type { Flag, ScoredWork, Severity, WorkRecord } from "./types.ts";

/**
 * Explainable screening rules that use ONLY fields present in the official dashboard export
 * (amount disbursed, completion date, work type, description, IDA, member, photo present?).
 * Fields the export does not carry (vendor, physical progress, geo-tag, sanctioned amount) are
 * never inferred. Output is a triage score for human review, not a finding of wrongdoing.
 */
export const RULES = {
  amountOutlier: { minPeers: 30, modifiedZ: 3.5, minRatioToMedian: 3, tiers: [{ z: 7, points: 26 }, { z: 5, points: 18 }, { z: 3.5, points: 10 }] },
  duplicate: { minDescriptionChars: 25, amountTolerance: 0.03, base: 16, exactAmountBonus: 6, sameDateBonus: 4 },
  sameDayBatch: { minWorksPerMemberDay: 30, points: 6 },
  highValueNoPhoto: { tiers: [{ amount: 2_500_000, points: 12 }, { amount: 1_000_000, points: 8 }] },
  missingAmount: 10,
  missingDescription: 6,
  dateIntegrity: 30,
} as const;

export const SEVERITY_CUTOFFS: { min: number; severity: Severity }[] = [
  { min: 40, severity: "critical" },
  { min: 30, severity: "high" },
  { min: 15, severity: "watch" },
  { min: 0, severity: "clear" },
];

export const severityFor = (risk: number): Severity => SEVERITY_CUTOFFS.find((c) => risk >= c.min)?.severity ?? "clear";

const inrText = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function median(sorted: number[]): number {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function normalizeDescription(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function analyzeDataset(works: WorkRecord[], retrievedDate: string): Map<string, ScoredWork> {
  const flagsBy = new Map<string, Flag[]>();
  const push = (f: Flag) => {
    const list = flagsBy.get(f.workCode);
    if (list) list.push(f); else flagsBy.set(f.workCode, [f]);
  };

  // 1. Amount outliers within the same work type (modified z-score on log amount).
  const byType = new Map<string, WorkRecord[]>();
  for (const w of works) {
    if (w.amount === null || w.amount <= 0) continue;
    const list = byType.get(w.workType);
    if (list) list.push(w); else byType.set(w.workType, [w]);
  }
  for (const [type, list] of byType) {
    if (list.length < RULES.amountOutlier.minPeers) continue;
    const logs = list.map((w) => Math.log(w.amount as number)).sort((a, b) => a - b);
    const med = median(logs);
    const mad = Math.max(median(logs.map((x) => Math.abs(x - med)).sort((a, b) => a - b)), 0.05);
    const medianAmount = Math.exp(med);
    for (const w of list) {
      const z = (0.6745 * (Math.log(w.amount as number) - med)) / mad;
      const ratio = (w.amount as number) / medianAmount;
      if (z < RULES.amountOutlier.modifiedZ || ratio < RULES.amountOutlier.minRatioToMedian) continue;
      const points = RULES.amountOutlier.tiers.find((t) => z >= t.z)?.points ?? 10;
      push({
        workCode: w.workCode, code: "AMOUNT_OUTLIER", title: "Amount far above peers", points,
        explanation: `${inrText(w.amount as number)} is ${ratio.toFixed(1)}× the median ${inrText(medianAmount)} of ${list.length.toLocaleString("en-IN")} works of the same type ("${type.slice(0, 80)}"). Robust z-score ${z.toFixed(1)}. Large works can be legitimate; check estimate, sanction and measurement book.`,
        evidence: { amount: w.amount, peerMedian: Math.round(medianAmount), peerCount: list.length, ratio: Number(ratio.toFixed(2)), robustZ: Number(z.toFixed(2)) },
      });
    }
  }

  // 2. Possible duplicates: same implementing authority + same description, amounts within tolerance.
  const groups = new Map<string, WorkRecord[]>();
  for (const w of works) {
    if (!w.description) continue;
    const nd = normalizeDescription(w.description);
    if (nd.length < RULES.duplicate.minDescriptionChars) continue;
    const key = `${w.ida}\u0001${nd}`;
    const list = groups.get(key);
    if (list) list.push(w); else groups.set(key, [w]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => (a.amount ?? -1) - (b.amount ?? -1));
    let cluster: WorkRecord[] = [];
    const flush = () => {
      if (cluster.length >= 2) {
        for (const w of cluster) {
          const others = cluster.filter((o) => o.workCode !== w.workCode);
          const exact = others.some((o) => o.amount === w.amount);
          const sameDate = others.some((o) => o.completionDate === w.completionDate);
          const points = RULES.duplicate.base + (exact ? RULES.duplicate.exactAmountBonus : 0) + (sameDate ? RULES.duplicate.sameDateBonus : 0);
          push({
            workCode: w.workCode, code: "POSSIBLE_DUPLICATE", title: "Possible duplicate entry", points,
            explanation: `Same implementing authority and identical description as ${others.length} other work${others.length > 1 ? "s" : ""} with ${exact ? "the same" : "a similar"} amount${sameDate ? " and completion date" : ""}. Could be repeated uploads or genuinely separate identical works; compare locations and bills.`,
            evidence: { sameAmount: exact, sameCompletionDate: sameDate, others: others.slice(0, 8).map((o) => ({ workCode: o.workCode, amount: o.amount, completionDate: o.completionDate })), groupSize: cluster.length },
          });
        }
      }
      cluster = [];
    };
    for (const w of sorted) {
      const last = cluster[cluster.length - 1];
      if (last && last.amount !== null && w.amount !== null && Math.abs(w.amount - last.amount) / Math.max(w.amount, last.amount, 1) <= RULES.duplicate.amountTolerance) cluster.push(w);
      else if (last && last.amount === null && w.amount === null) cluster.push(w);
      else { flush(); cluster = [w]; }
    }
    flush();
  }

  // 3. Same member, same completion date, very many works (possible batch entry).
  const days = new Map<string, WorkRecord[]>();
  for (const w of works) {
    const key = `${w.mpKey}|${w.completionDate}`;
    const list = days.get(key);
    if (list) list.push(w); else days.set(key, [w]);
  }
  for (const list of days.values()) {
    if (list.length < RULES.sameDayBatch.minWorksPerMemberDay) continue;
    for (const w of list) {
      push({
        workCode: w.workCode, code: "SAME_DAY_BATCH", title: "Many works completed same day", points: RULES.sameDayBatch.points,
        explanation: `${list.length} works for ${w.mpName} carry the completion date ${w.completionDate}. This usually reflects batch data entry rather than real simultaneous completion; completion dates may not be reliable for these works.`,
        evidence: { worksOnDate: list.length, date: w.completionDate },
      });
    }
  }

  // 4–7. Per-work checks.
  for (const w of works) {
    if (w.amount !== null && !w.hasImage) {
      const tier = RULES.highValueNoPhoto.tiers.find((t) => (w.amount as number) >= t.amount);
      if (tier) push({
        workCode: w.workCode, code: "HIGH_VALUE_NO_PHOTO", title: "High value, no photo on record", points: tier.points,
        explanation: `${inrText(w.amount)} disbursed but the dashboard shows no completion photo. Request geo-tagged photos and the completion certificate.`,
        evidence: { amount: w.amount },
      });
    }
    if (w.amount === null) push({
      workCode: w.workCode, code: "MISSING_AMOUNT", title: "Amount disbursed missing", points: RULES.missingAmount,
      explanation: "The official row has no amount disbursed, so expenditure cannot be checked.", evidence: {},
    });
    if (w.description === null) push({
      workCode: w.workCode, code: "MISSING_DESCRIPTION", title: "Work description missing", points: RULES.missingDescription,
      explanation: "The official row has no work description, so purpose and location cannot be checked.", evidence: {},
    });
    const fyStart = `${w.fy.slice(0, 4)}-04-01`;
    if (w.completionDate < fyStart || w.completionDate > retrievedDate) push({
      workCode: w.workCode, code: "DATE_INTEGRITY", title: "Completion date inconsistent", points: RULES.dateIntegrity,
      explanation: w.completionDate < fyStart
        ? `Completion date ${w.completionDate} is before the start of the financial year ${w.fy} in the work code.`
        : `Completion date ${w.completionDate} is after the dataset retrieval date ${retrievedDate}.`,
      evidence: { completionDate: w.completionDate, fy: w.fy },
    });
  }

  const out = new Map<string, ScoredWork>();
  for (const w of works) {
    const flags = flagsBy.get(w.workCode) ?? [];
    const risk = Math.min(100, flags.reduce((s, f) => s + f.points, 0));
    out.set(w.workCode, { workCode: w.workCode, risk, severity: severityFor(risk), flags });
  }
  return out;
}
