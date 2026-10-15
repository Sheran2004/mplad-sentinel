import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { Sql } from "../db.ts";
import { analyzeDataset } from "./analyze.ts";
import { normalizeAllocations, normalizeWorks, type RawDataset } from "./normalize.ts";

/** Bump when normalization or scoring rules change; forces a re-seed on next start. */
export const DATASET_VERSION = "2026-10-13.1";
const CHUNK = 1500;

export const DATA_FILE = "data/mplads-official-export.json";

const ARRAYS = ["lokSabhaAllocations", "rajyaSabhaAllocations", "lokSabhaCompletedWorks", "rajyaSabhaCompletedWorks"] as const;

export function parseRawDataset(text: string, label = DATA_FILE): RawDataset {
  let raw: Partial<RawDataset>;
  try { raw = JSON.parse(text) as Partial<RawDataset>; } catch { throw new Error(`${label} is not valid JSON.`); }
  for (const k of ARRAYS) if (!Array.isArray(raw[k])) throw new Error(`${label} is missing the "${k}" array. Expected the 4 arrays of the dashboard export.`);
  if (!raw[ARRAYS[2]]!.length && !raw[ARRAYS[3]]!.length) throw new Error(`${label} has no completed-works rows.`);
  for (const k of ["source", "sourceUrl", "retrievedDate"] as const) if (typeof raw[k] !== "string" || !raw[k]) throw new Error(`${label} is missing "${k}".`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.retrievedDate!)) throw new Error(`${label}: retrievedDate must be YYYY-MM-DD.`);
  return { notice: "", ...raw } as RawDataset;
}

/** Reads the dataset file and returns it with a content hash, so replacing the file triggers a reload automatically. */
export async function readDatasetFile(file?: string, root = process.cwd()): Promise<{ text: string; signature: string; path: string }> {
  const chosen = file ?? process.env.DATASET_FILE?.trim() ?? DATA_FILE;
  const path = isAbsolute(chosen) ? chosen : join(root, chosen);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new Error(`Official dataset not found at ${path}. Keep ${DATA_FILE} in the project root or set DATASET_FILE.`);
  }
  return { text, signature: createHash("sha256").update(text).digest("hex").slice(0, 16), path };
}

export async function loadRawDataset(root = process.cwd(), file?: string): Promise<RawDataset> {
  const { text, path } = await readDatasetFile(file, root);
  return parseRawDataset(text, path);
}

async function insertChunks<T>(rows: T[], run: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await run(rows.slice(i, i + CHUNK));
}

export async function seedDataset(sql: Sql, raw: RawDataset, signature = "unknown"): Promise<{ works: number; flags: number; allocations: number }> {
  const allocations = normalizeAllocations(raw);
  const { works, quality } = normalizeWorks(raw, allocations);
  const scored = analyzeDataset(works, raw.retrievedDate);

  await sql.query("DELETE FROM mplad_dataset_meta WHERE key = 'seed'");
  await sql.query("TRUNCATE mplad_works, mplad_flags, mplad_allocations");

  await insertChunks(allocations, (c) =>
    sql.query(
      `INSERT INTO mplad_allocations (id, chamber, state, mp_name, mp_key, constituency, member_type, allocated)
       SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::numeric[])`,
      [c.map((a) => a.id), c.map((a) => a.chamber), c.map((a) => a.state), c.map((a) => a.mpName), c.map((a) => a.mpKey),
        c.map((a) => a.constituency), c.map((a) => a.memberType), c.map((a) => a.allocated)],
    ),
  );

  await insertChunks(works, (c) => {
    const s = c.map((w) => scored.get(w.workCode)!);
    return sql.query(
      `INSERT INTO mplad_works (work_code, mp_ref, fy, work_type, category, state, ida, description, mp_name, mp_key, chamber,
         constituency, has_image, completion_date, amount, risk, severity, flag_count, flag_codes, search_text)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[],
         $10::text[], $11::text[], $12::text[], $13::boolean[], $14::date[], $15::numeric[], $16::int[], $17::text[], $18::int[], $19::text[], $20::text[])`,
      [
        c.map((w) => w.workCode), c.map((w) => w.mpRef), c.map((w) => w.fy), c.map((w) => w.workType), c.map((w) => w.category),
        c.map((w) => w.state), c.map((w) => w.ida), c.map((w) => w.description), c.map((w) => w.mpName), c.map((w) => w.mpKey),
        c.map((w) => w.chamber), c.map((w) => w.constituency), c.map((w) => w.hasImage), c.map((w) => w.completionDate),
        c.map((w) => w.amount), s.map((x) => x.risk), s.map((x) => x.severity), s.map((x) => x.flags.length),
        s.map((x) => (x.flags.length ? `|${x.flags.map((f) => f.code).join("|")}|` : "")),
        c.map((w) => `${w.workCode} ${w.description ?? ""} ${w.workType} ${w.mpName} ${w.ida} ${w.constituency ?? ""} ${w.state}`.toLowerCase()),
      ],
    );
  });

  const flags = [...scored.values()].flatMap((s) => s.flags);
  await insertChunks(flags, (c) =>
    sql.query(
      `INSERT INTO mplad_flags (work_code, code, title, explanation, points, evidence)
       SELECT wc, cd, ti, ex, pt, ev::jsonb FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[]) AS t(wc, cd, ti, ex, pt, ev)`,
      [c.map((f) => f.workCode), c.map((f) => f.code), c.map((f) => f.title), c.map((f) => f.explanation), c.map((f) => f.points),
        c.map((f) => JSON.stringify(f.evidence))],
    ),
  );

  const upsert = (key: string, value: unknown) =>
    sql.query(
      `INSERT INTO mplad_dataset_meta (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
  await upsert("quality", quality);
  await upsert("seed", { version: DATASET_VERSION, signature, seededAt: new Date().toISOString(), works: works.length, flags: flags.length, allocations: allocations.length });
  return { works: works.length, flags: flags.length, allocations: allocations.length };
}

const g = globalThis as typeof globalThis & { __mpladSeed__?: Promise<void> };

/** Seed on first use when the DB is empty, was seeded by an older rule version, or the dataset file changed. */
export function ensureSeeded(sql: Sql): Promise<void> {
  g.__mpladSeed__ ??= (async () => {
    let rows: { value: { version?: string; signature?: string } }[];
    try {
      rows = await sql.query<{ value: { version?: string; signature?: string } }>("SELECT value FROM mplad_dataset_meta WHERE key = 'seed'");
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "42P01" || /does not exist/i.test(e.message ?? "")) {
        throw new Error("Database tables are missing. Stop the server and run: npm run db:migrate && npm run db:seed, then start again.");
      }
      throw err;
    }
    const loaded = rows[0]?.value;
    // Production serverless bundles don't ship data/, and `db:seed` already loaded it at build time: trust the database.
    if (process.env.NODE_ENV === "production" && loaded?.version === DATASET_VERSION) return;
    let file: Awaited<ReturnType<typeof readDatasetFile>>;
    try {
      file = await readDatasetFile();
    } catch (err) {
      if (loaded?.version === DATASET_VERSION) return; // data already in the DB; the file is only needed to refresh it
      throw err;
    }
    if (loaded?.version === DATASET_VERSION && loaded?.signature === file.signature) return;
    const res = await seedDataset(sql, parseRawDataset(file.text, file.path), file.signature);
    console.log(`[dataset] seeded ${res.works} works, ${res.flags} flags, ${res.allocations} allocations from ${file.path}`);
  })().catch((err) => {
    g.__mpladSeed__ = undefined;
    throw err;
  });
  return g.__mpladSeed__;
}