#!/usr/bin/env node
/**
 * Loads an MPLADS dashboard export into the database. Reviews, notes, users and the audit log are never touched.
 *
 *   node scripts/seed.mjs                       load data/mplads-official-export.json (skips if already loaded)
 *   node scripts/seed.mjs --file new.json       load another export (same 4-array format)
 *   node scripts/seed.mjs --file new.json --dry-run   validate and print the data-quality summary only
 *   node scripts/seed.mjs --force               reload even if unchanged
 *
 * Needs DATABASE_URL (Postgres/Neon). Without it the embedded PGlite database seeds itself on the first
 * request and reloads automatically when the dataset file's content changes.
 */
import pg from "pg";
import { DATASET_VERSION, parseRawDataset, readDatasetFile, seedDataset } from "../src/lib/dataset/seed.server.ts";
import { analyzeDataset } from "../src/lib/dataset/analyze.ts";
import { normalizeAllocations, normalizeWorks } from "../src/lib/dataset/normalize.ts";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : undefined;
if (args.includes("--file") && !fileArg) { console.error("[seed] --file needs a path"); process.exit(1); }

const file = await readDatasetFile(fileArg);
const raw = parseRawDataset(file.text, file.path);

if (flag("--dry-run")) {
  const { works, quality } = normalizeWorks(raw, normalizeAllocations(raw));
  const scored = analyzeDataset(works, raw.retrievedDate);
  const sev = {};
  for (const s of scored.values()) sev[s.severity] = (sev[s.severity] ?? 0) + 1;
  console.log(`[seed] ${file.path} (sha ${file.signature}) retrieved ${raw.retrievedDate}`);
  console.log(JSON.stringify({ rows: quality.rows, attribution: quality.attribution, missing: quality.missing, dateIssues: quality.dateIssues, severity: sev }, null, 2));
  for (const f of quality.findings) console.log(`[finding] ${f}`);
  process.exit(0);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("[seed] DATABASE_URL not set — skipping (local PGlite seeds itself on first request).");
  process.exit(0);
}
const pool = new pg.Pool({ connectionString: url, max: 1 });
pool.on("error", (e) => console.error("[seed] pool error", e));
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1082, (v) => v); // keep DATE columns as YYYY-MM-DD strings
const sql = Object.assign(() => { throw new Error("tagged form unused"); }, {
  query: async (text, params = []) => (await pool.query(text, params)).rows,
});
try {
  const have = await sql.query("SELECT value FROM mplad_dataset_meta WHERE key = 'seed'").catch(() => []);
  const cur = have[0]?.value;
  if (cur?.version === DATASET_VERSION && cur?.signature === file.signature && !flag("--force")) {
    console.log(`[seed] dataset ${DATASET_VERSION} (${file.signature}) already loaded — nothing to do (use --force to reload).`);
  } else {
    const before = (await sql.query("SELECT count(*) AS n FROM mplad_works").catch(() => [{ n: 0 }]))[0].n;
    const res = await seedDataset(sql, raw, file.signature);
    console.log(`[seed] loaded ${res.works} works (was ${before}), ${res.flags} flags, ${res.allocations} allocations from ${file.path}.`);
  }
} finally {
  await pool.end();
}
