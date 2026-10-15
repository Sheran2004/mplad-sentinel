import type { AllocationRecord, Chamber, QualityReport, WorkRecord } from "./types.ts";

/** Shape of the downloaded dashboard export (public/dashboard exports, kept unmodified). */
export type RawRow = Record<string, string | number | null | undefined>;
export type RawDataset = {
  source: string;
  sourceUrl: string;
  retrievedDate: string;
  notice: string;
  lokSabhaAllocations: RawRow[];
  rajyaSabhaAllocations: RawRow[];
  lokSabhaCompletedWorks: RawRow[];
  rajyaSabhaCompletedWorks: RawRow[];
};

const HONORIFICS = new Set([
  "shri", "shree", "smt", "shrimati", "dr", "prof", "professor", "sri", "adv", "advocate",
  "er", "mr", "mrs", "ms", "late", "hon", "ble",
]);

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  if (!s || s.toLowerCase() === "nan" || s.toLowerCase() === "null" || s.toLowerCase() === "none") return null;
  return s;
}

/** Order- and punctuation-insensitive member key; strips honorifics and "(NaN-NaN)" style suffixes. */
export function mpKey(name: string): string {
  const tokens = name
    .replace(/\(.*?\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !HONORIFICS.has(t));
  return tokens.sort().join("");
}

export function cleanMpName(name: string): string {
  return name.replace(/\s*\((?:NaN-NaN|\d{4}-\d{2,4})\)/gi, "").replace(/\s*\(\s*\)/g, "").replace(/\s+/g, " ").trim();
}

export function parseDashboardDate(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  const iso = `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

export function parseAmount(value: unknown): number | null {
  const s = str(value);
  if (!s) return null;
  const n = Number(s.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const WORK_RE = /^WS\/\s*MP\s*(\d+)\/\s*(\d{4}-\d{4})\/\s*(\d+)\s*-\s*([\s\S]+)$/i;

export function parseWorkString(raw: unknown): { workCode: string; mpRef: string; fy: string; workType: string } | null {
  const s = str(raw);
  if (!s) return null;
  const m = WORK_RE.exec(s);
  if (!m) return null;
  return { workCode: `WS/MP${m[1]}/${m[2]}/${m[3]}`, mpRef: `MP${m[1]}`, fy: m[2], workType: m[4].replace(/\s+/g, " ").trim() };
}

export function normalizeAllocations(raw: RawDataset): AllocationRecord[] {
  const out: AllocationRecord[] = [];
  let id = 1;
  for (const r of raw.lokSabhaAllocations) {
    const name = str(r["Hon'ble Members of Parliaments"] ?? r["Hon'ble Members of Parliament"]);
    const state = str(r["State"]);
    if (!name || !state) continue;
    out.push({
      id: id++, chamber: "LS", state, mpName: cleanMpName(name), mpKey: mpKey(name),
      constituency: str(r["Constituency"]), memberType: null, allocated: parseAmount(r["Allocated AMOUNT ( ₹ )"]),
    });
  }
  for (const r of raw.rajyaSabhaAllocations) {
    const name = str(r["Hon'ble Members of Parliament"] ?? r["Hon'ble Members of Parliaments"]);
    const state = str(r["State"]);
    if (!name || !state) continue;
    out.push({
      id: id++, chamber: "RS", state, mpName: cleanMpName(name), mpKey: mpKey(name),
      constituency: null, memberType: str(r["Elected/Nominated"]), allocated: parseAmount(r["Allocated AMOUNT ( ₹ )"]),
    });
  }
  return out;
}

const workKey = (r: RawRow) =>
  [str(r["Work"]), str(r["State"]), str(r["IDA"]), str(r["Work Description"]), str(r["Completion Date"]), str(r["Amount Disbursed ( ₹ )"])].join("\u0001");

/**
 * Merge the two dashboard work exports into one unique set keyed by work code.
 * Chamber and constituency are derived by matching the member against the allocation lists
 * (never guessed from which file a row came from, because the exports overlap).
 */
export function normalizeWorks(raw: RawDataset, allocations: AllocationRecord[]): { works: WorkRecord[]; quality: QualityReport } {
  const lsAlloc = allocations.filter((a) => a.chamber === "LS");
  const rsKeys = new Set(allocations.filter((a) => a.chamber === "RS").map((a) => a.mpKey));
  const lsByStateKey = new Map<string, Set<string>>();
  const lsKeys = new Set<string>();
  for (const a of lsAlloc) {
    lsKeys.add(a.mpKey);
    const k = `${a.state.toLowerCase()}|${a.mpKey}`;
    if (!lsByStateKey.has(k)) lsByStateKey.set(k, new Set());
    if (a.constituency) lsByStateKey.get(k)!.add(a.constituency);
  }

  const lsRowKeys = new Set(raw.lokSabhaCompletedWorks.map(workKey));
  let overlap = 0;
  let rsMatchRs = 0;
  let rsMatchLs = 0;
  for (const r of raw.rajyaSabhaCompletedWorks) {
    if (lsRowKeys.has(workKey(r))) overlap++;
    const name = str(r["Hon'ble Members of Parliament"]);
    if (!name) continue;
    const k = mpKey(name);
    if (rsKeys.has(k) && !lsKeys.has(k)) rsMatchRs++;
    if (lsKeys.has(k)) rsMatchLs++;
  }

  const byCode = new Map<string, WorkRecord>();
  let unparsed = 0;
  let removed = 0;
  const ingest = (rows: RawRow[], fileTag: "ls" | "rs") => {
    for (const r of rows) {
      const parsed = parseWorkString(r["Work"]);
      const date = parseDashboardDate(r["Completion Date"]);
      const mpRaw = str(r["Hon'ble Members of Parliament"] ?? r["Hon'ble Members of Parliaments"]);
      const state = str(r["State"]);
      const ida = str(r["IDA"]);
      if (!parsed || !date || !mpRaw || !state || !ida) { unparsed++; continue; }
      const key = mpKey(mpRaw);
      let chamber: Chamber = "unknown";
      if (lsKeys.has(key)) chamber = "LS";
      else if (rsKeys.has(key)) chamber = "RS";
      let constituency = str(r["Constituency"]);
      if (!constituency && chamber === "LS") {
        const set = lsByStateKey.get(`${state.toLowerCase()}|${key}`);
        if (set && set.size === 1) constituency = [...set][0];
      }
      const rec: WorkRecord = {
        ...parsed,
        category: str(r["Work Category"]) ?? "Unspecified",
        state, ida,
        description: str(r["Work Description"]),
        mpName: cleanMpName(mpRaw), mpKey: key, chamber, constituency,
        hasImage: str(r["Image"]) !== null,
        completionDate: date,
        amount: parseAmount(r["Amount Disbursed ( ₹ )"]),
      };
      const existing = byCode.get(rec.workCode);
      if (existing) {
        removed++;
        // Keep the richer record (LS export carries the constituency directly).
        if (!existing.constituency && rec.constituency) existing.constituency = rec.constituency;
        if (!existing.hasImage && rec.hasImage) existing.hasImage = true;
        continue;
      }
      byCode.set(rec.workCode, rec);
    }
    void fileTag;
  };
  ingest(raw.lokSabhaCompletedWorks, "ls");
  ingest(raw.rajyaSabhaCompletedWorks, "rs");
  const works = [...byCode.values()];

  const retrieved = raw.retrievedDate;
  let before = 0;
  let after = 0;
  for (const w of works) {
    if (w.completionDate < `${w.fy.slice(0, 4)}-04-01`) before++;
    if (w.completionDate > retrieved) after++;
  }
  const ls = works.filter((w) => w.chamber === "LS").length;
  const rs = works.filter((w) => w.chamber === "RS").length;
  const quality: QualityReport = {
    generatedFrom: { source: raw.source, sourceUrl: raw.sourceUrl, retrievedDate: raw.retrievedDate, notice: raw.notice },
    rows: {
      lokSabhaExport: raw.lokSabhaCompletedWorks.length,
      rajyaSabhaExport: raw.rajyaSabhaCompletedWorks.length,
      unionUnique: works.length,
      overlapBetweenExports: overlap,
      duplicateRowsRemoved: removed,
      unparsedWorkCodes: unparsed,
    },
    attribution: {
      lokSabha: ls, rajyaSabha: rs, unknown: works.length - ls - rs,
      rajyaExportRowsMatchingRajyaSabhaMembers: rsMatchRs,
      rajyaExportRowsMatchingLokSabhaMembers: rsMatchLs,
    },
    missing: {
      amount: works.filter((w) => w.amount === null).length,
      description: works.filter((w) => w.description === null).length,
      image: works.filter((w) => !w.hasImage).length,
      constituency: works.filter((w) => w.chamber === "LS" && !w.constituency).length,
    },
    dateIssues: { beforeFinancialYear: before, afterRetrieval: after },
    findings: [],
  };

  if (rs === 0 && raw.rajyaSabhaCompletedWorks.length > 0) {
    quality.findings.push(
      `The "Rajya Sabha completed works" export (${raw.rajyaSabhaCompletedWorks.length.toLocaleString("en-IN")} rows) contains no work attributable to a Rajya Sabha member: ${rsMatchLs.toLocaleString("en-IN")} rows match Lok Sabha members and ${rsMatchRs} match Rajya Sabha members. It also repeats all ${overlap.toLocaleString("en-IN")} rows of the Lok Sabha export. The two files were therefore merged by work code instead of added together; summing them would double count. Re-download the Rajya Sabha tab from the dashboard to obtain genuine Rajya Sabha works.`,
    );
  }
  if (raw.lokSabhaCompletedWorks.length === 27000 && works.length > 27000) {
    quality.findings.push(
      "The Lok Sabha export has exactly 27,000 rows while the other file has more unique works for Lok Sabha members, so the Lok Sabha export looks truncated at a download limit. The merged set is used so no work is dropped.",
    );
  }
  if (removed > 0) quality.findings.push(`${removed.toLocaleString("en-IN")} repeated rows (same work code) were merged.`);
  if (unparsed > 0) quality.findings.push(`${unparsed} rows could not be parsed (missing work code, date, member, state or IDA) and were skipped.`);
  return { works, quality };
}
