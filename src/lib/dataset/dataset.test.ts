import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeDataset, severityFor } from "./analyze.ts";
import { mpKey, normalizeAllocations, normalizeWorks, parseAmount, parseDashboardDate, parseWorkString, type RawDataset, type RawRow } from "./normalize.ts";

const row = (over: Partial<Record<string, string>> = {}): RawRow => ({
  "Sr. No.": "1", State: "Bihar", IDA: "ARARIA(DM ARARIA_IDA)", Work: "WS/MP10/2024-2025/1001-Installing hand pumps",
  "Work Category": "Normal/Others", "Work Description": "Hand pump near primary school in village Rampur block Forbesganj",
  "Hon'ble Members of Parliament": "Shri Test Member", Constituency: "ARARIA", Image: "Images", "Completion Date": "10-Jan-2025",
  "Amount Disbursed ( ₹ )": "100000", "Elected/Nominated": "Elected MP", ...over,
});

const raw = (ls: RawRow[], rs: RawRow[] = []): RawDataset => ({
  source: "test", sourceUrl: "https://example.test", retrievedDate: "2026-10-10", notice: "n",
  lokSabhaAllocations: [{ State: "Bihar", "Hon'ble Members of Parliaments": "Shri Test Member", Constituency: "ARARIA", "Allocated AMOUNT ( ₹ )": "50000000" }],
  rajyaSabhaAllocations: [{ State: "Bihar", "Hon'ble Members of Parliament": "Smt Rs Person (2026-32) (2026-2032)", "Elected/Nominated": "Elected MP", "Allocated AMOUNT ( ₹ )": "1" }],
  lokSabhaCompletedWorks: ls, rajyaSabhaCompletedWorks: rs,
});

test("parsers", () => {
  assert.equal(parseDashboardDate("05-Feb-2026"), "2026-02-05");
  assert.equal(parseDashboardDate("31-Feb-2026"), null);
  assert.equal(parseAmount("1,25,000"), 125000);
  assert.equal(parseAmount("nan"), null);
  assert.equal(parseWorkString("WS/\tMP620/2024-2025/9-Road")?.workCode, "WS/MP620/2024-2025/9");
  assert.equal(parseWorkString("garbage"), null);
  assert.equal(mpKey("Shri Test Member (NaN-NaN)"), mpKey("MEMBER TEST"));
});

test("overlapping exports are merged, not double counted; chamber comes from the member list", () => {
  const ls = [row()];
  const rs = [row(), row({ Work: "WS/MP10/2024-2025/1002-Installing hand pumps", "Hon'ble Members of Parliament": "Shri Test Member (NaN-NaN)", Constituency: "" })];
  const r = raw(ls, rs);
  const { works, quality } = normalizeWorks(r, normalizeAllocations(r));
  assert.equal(works.length, 2);
  assert.ok(works.every((w) => w.chamber === "LS"));
  assert.equal(works.find((w) => w.workCode.endsWith("/1002"))?.constituency, "ARARIA");
  assert.equal(quality.attribution.rajyaSabha, 0);
  assert.ok(quality.findings.some((f) => f.includes("Rajya Sabha")));
});

test("rules fire on duplicates, outliers, missing photo and bad dates", () => {
  const rows: RawRow[] = [];
  for (let i = 0; i < 40; i++) rows.push(row({ Work: `WS/MP10/2024-2025/${2000 + i}-Installing hand pumps`, "Work Description": `Unique description number ${i} for village ${i}`, "Amount Disbursed ( ₹ )": String(100000 + (i % 5) * 1000), "Completion Date": `${(i % 27) + 1}-Mar-2025` }));
  rows.push(row({ Work: "WS/MP10/2024-2025/3000-Installing hand pumps", "Work Description": "Unique outlier work description here", "Amount Disbursed ( ₹ )": "5000000", Image: "" }));
  rows.push(row({ Work: "WS/MP10/2024-2025/3001-Road", "Work Description": "Repeated description long enough to compare", "Amount Disbursed ( ₹ )": "200000" }));
  rows.push(row({ Work: "WS/MP10/2024-2025/3002-Road", "Work Description": "Repeated description long enough to compare", "Amount Disbursed ( ₹ )": "200000" }));
  rows.push(row({ Work: "WS/MP10/2024-2025/3003-Road", "Completion Date": "01-Jan-2024" }));
  const r = raw(rows);
  const { works } = normalizeWorks(r, normalizeAllocations(r));
  const scored = analyzeDataset(works, r.retrievedDate);
  const codes = (n: string) => scored.get(`WS/MP10/2024-2025/${n}`)!.flags.map((f) => f.code);
  assert.ok(codes("3000").includes("AMOUNT_OUTLIER"));
  assert.ok(codes("3000").includes("HIGH_VALUE_NO_PHOTO"));
  assert.ok(codes("3001").includes("POSSIBLE_DUPLICATE") && codes("3002").includes("POSSIBLE_DUPLICATE"));
  assert.ok(codes("3003").includes("DATE_INTEGRITY"));
  assert.deepEqual(codes("2000"), []);
  assert.equal(scored.get("WS/MP10/2024-2025/2000")!.severity, "clear");
});

test("severity cutoffs", () => {
  assert.equal(severityFor(0), "clear");
  assert.equal(severityFor(15), "watch");
  assert.equal(severityFor(30), "high");
  assert.equal(severityFor(40), "critical");
});
