import type { Sql } from "../db.ts";

export type WorksFilter = {
  q?: string; state?: string; workType?: string; fy?: string; severity?: string; flag?: string; mpKey?: string;
  photo?: "yes" | "no"; minAmount?: number; maxAmount?: number;
  sort?: "risk" | "amount" | "date"; dir?: "asc" | "desc"; page?: number; pageSize?: number;
};

export type WorkRow = {
  workCode: string; fy: string; workType: string; category: string; state: string; ida: string; description: string | null;
  mpName: string; chamber: string; constituency: string | null; hasImage: boolean; completionDate: string; amount: number | null;
  risk: number; severity: "critical" | "high" | "watch" | "clear"; flagCodes: string[];
};

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const SORTS = { risk: "risk", amount: "amount", date: "completion_date" } as const;

function like(s: string) {
  return `%${s.toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export function buildWhere(f: WorksFilter): { where: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const add = (sqlPart: string, value: unknown) => { params.push(value); parts.push(sqlPart.replace("?", `$${params.length}`)); };
  if (f.q?.trim()) for (const term of f.q.trim().split(/\s+/).slice(0, 6)) add("search_text LIKE ?", like(term));
  if (f.state) add("state = ?", f.state);
  if (f.workType) add("work_type = ?", f.workType);
  if (f.fy) add("fy = ?", f.fy);
  if (f.mpKey) add("mp_key = ?", f.mpKey);
  if (f.severity === "flagged") parts.push("severity <> 'clear'");
  else if (f.severity && ["critical", "high", "watch", "clear"].includes(f.severity)) add("severity = ?", f.severity);
  if (f.flag) add("flag_codes LIKE ?", `%|${f.flag.replace(/[^A-Z_]/g, "")}|%`);
  if (f.photo === "yes") parts.push("has_image = TRUE");
  if (f.photo === "no") parts.push("has_image = FALSE");
  if (Number.isFinite(f.minAmount)) add("amount >= ?", f.minAmount);
  if (Number.isFinite(f.maxAmount)) add("amount <= ?", f.maxAmount);
  return { where: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

const WORK_COLS = `work_code, fy, work_type, category, state, ida, description, mp_name, chamber, constituency, has_image,
  completion_date, amount, risk, severity, flag_codes`;

type DbWork = {
  work_code: string; fy: string; work_type: string; category: string; state: string; ida: string; description: string | null;
  mp_name: string; chamber: string; constituency: string | null; has_image: boolean; completion_date: string; amount: string | number | null;
  risk: number; severity: WorkRow["severity"]; flag_codes: string;
};

const mapWork = (r: DbWork): WorkRow => ({
  workCode: r.work_code, fy: r.fy, workType: r.work_type, category: r.category, state: r.state, ida: r.ida, description: r.description,
  mpName: r.mp_name, chamber: r.chamber, constituency: r.constituency, hasImage: r.has_image, completionDate: r.completion_date,
  amount: num(r.amount), risk: Number(r.risk), severity: r.severity, flagCodes: r.flag_codes.split("|").filter(Boolean),
});

export async function searchWorks(sql: Sql, f: WorksFilter) {
  const { where, params } = buildWhere(f);
  const pageSize = Math.min(Math.max(Math.trunc(f.pageSize ?? 25), 1), 100);
  const page = Math.max(Math.trunc(f.page ?? 0), 0);
  const sortCol = SORTS[f.sort ?? "risk"] ?? "risk";
  const dir = f.dir === "asc" ? "ASC" : "DESC";
  const totals = await sql.query<{ total: number; amount: string | null; flagged: number }>(
    `SELECT count(*) AS total, sum(amount) AS amount, count(*) FILTER (WHERE severity <> 'clear') AS flagged FROM mplad_works ${where}`,
    params,
  );
  const rows = await sql.query<DbWork>(
    `SELECT ${WORK_COLS} FROM mplad_works ${where} ORDER BY ${sortCol} ${dir} NULLS LAST, work_code ASC LIMIT ${pageSize} OFFSET ${page * pageSize}`,
    params,
  );
  return { rows: rows.map(mapWork), total: Number(totals[0].total), flagged: Number(totals[0].flagged), amount: num(totals[0].amount) ?? 0, page, pageSize };
}

export async function exportWorksCsv(sql: Sql, f: WorksFilter): Promise<{ csv: string; rows: number }> {
  const { where, params } = buildWhere(f);
  const sortCol = SORTS[f.sort ?? "risk"] ?? "risk";
  const rows = await sql.query<DbWork>(
    `SELECT ${WORK_COLS} FROM mplad_works ${where} ORDER BY ${sortCol} ${f.dir === "asc" ? "ASC" : "DESC"} NULLS LAST, work_code ASC LIMIT 50000`,
    params,
  );
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : /^[=+\-@]/.test(s) ? `'${s}` : s;
  };
  const head = ["work_code", "financial_year", "work_type", "state", "implementing_authority", "description", "member", "chamber", "constituency",
    "completion_date", "amount_disbursed_inr", "photo_on_record", "risk_score", "severity", "indicators"];
  const lines = [head.join(",")];
  for (const r of rows.map(mapWork)) {
    lines.push([r.workCode, r.fy, r.workType, r.state, r.ida, r.description, r.mpName, r.chamber, r.constituency, r.completionDate,
      r.amount, r.hasImage ? "yes" : "no", r.risk, r.severity, r.flagCodes.join(" ")].map(esc).join(","));
  }
  return { csv: lines.join("\r\n"), rows: rows.length };
}

export async function getWorkDetail(sql: Sql, workCode: string) {
  const rows = await sql.query<DbWork & { mp_ref: string }>(`SELECT ${WORK_COLS}, mp_ref FROM mplad_works WHERE work_code = $1`, [workCode]);
  if (!rows[0]) return null;
  const flags = await sql.query<{ code: string; title: string; explanation: string; points: number; evidence: Json }>(
    "SELECT code, title, explanation, points, evidence FROM mplad_flags WHERE work_code = $1 ORDER BY points DESC, code",
    [workCode],
  );
  const review = await sql.query<{ status: string; note: string; updated_at: string }>(
    "SELECT status, note, updated_at FROM mplad_case_reviews WHERE work_id = $1", [workCode],
  );
  const events = await sql.query<{ previous_status: string | null; new_status: string; created_at: string }>(
    "SELECT previous_status, new_status, created_at FROM mplad_case_review_events WHERE work_id = $1 ORDER BY created_at DESC LIMIT 20", [workCode],
  );
  return {
    work: { ...mapWork(rows[0]), mpRef: rows[0].mp_ref },
    flags: flags.map((f) => ({ ...f, points: Number(f.points) })),
    review: review[0] ? { status: review[0].status, note: review[0].note ?? "", updatedAt: iso(review[0].updated_at) } : { status: "open", note: "", updatedAt: null },
    events: events.map((e) => ({ from: e.previous_status, to: e.new_status, at: iso(e.created_at) })),
  };
}

export async function getFacets(sql: Sql) {
  const [states, types, fys, flags] = await Promise.all([
    sql.query<{ v: string; n: number }>("SELECT state AS v, count(*) AS n FROM mplad_works GROUP BY state ORDER BY state"),
    sql.query<{ v: string; n: number }>("SELECT work_type AS v, count(*) AS n FROM mplad_works GROUP BY work_type ORDER BY n DESC"),
    sql.query<{ v: string; n: number }>("SELECT fy AS v, count(*) AS n FROM mplad_works GROUP BY fy ORDER BY fy DESC"),
    sql.query<{ code: string; n: number; works: number }>("SELECT code, count(*) AS n, count(DISTINCT work_code) AS works FROM mplad_flags GROUP BY code ORDER BY n DESC"),
  ]);
  const c = (r: { v: string; n: number }) => ({ value: r.v, count: Number(r.n) });
  return { states: states.map(c), workTypes: types.map(c), fys: fys.map(c), flags: flags.map((f) => ({ code: f.code, count: Number(f.n) })) };
}

export async function getOverview(sql: Sql) {
  const [tot, sev, byMonth, byState, byType, meta, alloc] = await Promise.all([
    sql.query<{ works: number; amount: string; states: number; mps: number; photo: number; flagged: number; first: string; last: string }>(
      `SELECT count(*) AS works, coalesce(sum(amount),0) AS amount, count(DISTINCT state) AS states, count(DISTINCT mp_key) AS mps,
              count(*) FILTER (WHERE has_image) AS photo, count(*) FILTER (WHERE severity <> 'clear') AS flagged,
              min(completion_date) AS first, max(completion_date) AS last FROM mplad_works`),
    sql.query<{ severity: string; n: number }>("SELECT severity, count(*) AS n FROM mplad_works GROUP BY severity"),
    sql.query<{ m: string; n: number; amount: string }>(
      "SELECT to_char(completion_date, 'YYYY-MM') AS m, count(*) AS n, coalesce(sum(amount),0) AS amount FROM mplad_works GROUP BY 1 ORDER BY 1"),
    sql.query<{ state: string; n: number; amount: string; flagged: number }>(
      `SELECT state, count(*) AS n, coalesce(sum(amount),0) AS amount, count(*) FILTER (WHERE severity <> 'clear') AS flagged
       FROM mplad_works GROUP BY state ORDER BY sum(amount) DESC NULLS LAST LIMIT 12`),
    sql.query<{ work_type: string; n: number; amount: string }>(
      `SELECT work_type, count(*) AS n, coalesce(sum(amount),0) AS amount FROM mplad_works GROUP BY work_type ORDER BY sum(amount) DESC NULLS LAST LIMIT 10`),
    sql.query<{ key: string; value: unknown }>("SELECT key, value FROM mplad_dataset_meta"),
    sql.query<{ chamber: string; n: number; amount: string }>("SELECT chamber, count(*) AS n, coalesce(sum(allocated),0) AS amount FROM mplad_allocations GROUP BY chamber"),
  ]);
  const t = tot[0];
  const metaMap = Object.fromEntries(meta.map((m) => [m.key, m.value]));
  return {
    totals: { works: Number(t.works), amount: Number(t.amount), states: Number(t.states), members: Number(t.mps), withPhoto: Number(t.photo), flagged: Number(t.flagged), firstDate: t.first, lastDate: t.last },
    severity: Object.fromEntries(sev.map((s) => [s.severity, Number(s.n)])) as Record<string, number>,
    byMonth: byMonth.map((m) => ({ month: m.m, works: Number(m.n), amount: Number(m.amount) })),
    byState: byState.map((s) => ({ state: s.state, works: Number(s.n), amount: Number(s.amount), flagged: Number(s.flagged) })),
    byType: byType.map((s) => ({ workType: s.work_type, works: Number(s.n), amount: Number(s.amount) })),
    allocations: alloc.map((a) => ({ chamber: a.chamber, members: Number(a.n), allocated: Number(a.amount) })),
    quality: metaMap["quality"] ?? null,
    seed: metaMap["seed"] ?? null,
  };
}

export type MpFilter = { q?: string; state?: string; sort?: "disbursed" | "works" | "flagged" | "allocated"; page?: number; pageSize?: number };

export async function listMembers(sql: Sql, f: MpFilter) {
  const params: unknown[] = [];
  const parts: string[] = [];
  if (f.q?.trim()) { params.push(like(f.q.trim())); parts.push(`lower(mp_name || ' ' || coalesce(constituency,'')) LIKE $${params.length}`); }
  if (f.state) { params.push(f.state); parts.push(`state = $${params.length}`); }
  const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  const sortCol = ({ disbursed: "disbursed", works: "works", flagged: "flagged", allocated: "allocated" } as const)[f.sort ?? "disbursed"] ?? "disbursed";
  const pageSize = Math.min(Math.max(Math.trunc(f.pageSize ?? 25), 1), 100);
  const page = Math.max(Math.trunc(f.page ?? 0), 0);
  const base = `
    WITH m AS (
      SELECT w.mp_key, w.state, min(w.mp_name) AS mp_name, min(w.constituency) AS constituency, min(w.chamber) AS chamber,
             count(*) AS works, coalesce(sum(w.amount),0) AS disbursed,
             count(*) FILTER (WHERE w.has_image) AS with_photo, count(*) FILTER (WHERE w.severity <> 'clear') AS flagged,
             max(a.allocated) AS allocated
      FROM mplad_works w
      LEFT JOIN (SELECT mp_key, lower(state) AS st, max(allocated) AS allocated FROM mplad_allocations GROUP BY mp_key, lower(state)) a
        ON a.mp_key = w.mp_key AND a.st = lower(w.state)
      GROUP BY w.mp_key, w.state
    )`;
  const total = await sql.query<{ n: number }>(`${base} SELECT count(*) AS n FROM m ${where}`, params);
  const rows = await sql.query<{ mp_key: string; state: string; mp_name: string; constituency: string | null; chamber: string; works: number; disbursed: string; with_photo: number; flagged: number; allocated: string | null }>(
    `${base} SELECT * FROM m ${where} ORDER BY ${sortCol} DESC NULLS LAST, mp_name ASC LIMIT ${pageSize} OFFSET ${page * pageSize}`, params);
  return {
    total: Number(total[0].n), page, pageSize,
    rows: rows.map((r) => ({
      mpKey: r.mp_key, state: r.state, name: r.mp_name, constituency: r.constituency, chamber: r.chamber, works: Number(r.works),
      disbursed: Number(r.disbursed), withPhoto: Number(r.with_photo), flagged: Number(r.flagged), allocated: num(r.allocated),
    })),
  };
}

/** Compact plain-text context for the AI desk, built server-side so the client can't inject "facts". */
export async function buildAiContext(sql: Sql, workCode?: string): Promise<string> {
  const ov = await getOverview(sql);
  const lines = [
    `Dataset: MPLADS public dashboard export retrieved ${(ov.quality as { generatedFrom?: { retrievedDate?: string } } | null)?.generatedFrom?.retrievedDate ?? "unknown"}; not independently verified.`,
    `${ov.totals.works.toLocaleString("en-IN")} completed works, ₹${Math.round(ov.totals.amount).toLocaleString("en-IN")} disbursed, ${ov.totals.states} states, ${ov.totals.members} members; ${ov.totals.flagged} works carry screening indicators (${JSON.stringify(ov.severity)}).`,
    "Available fields per work: code, type, state, implementing authority, description, member, completion date, amount disbursed, whether a photo exists. NOT available: vendor, physical progress, geo-tag, sanctioned amount.",
  ];
  if (workCode) {
    const d = await getWorkDetail(sql, workCode);
    if (d) {
      const w = d.work;
      lines.push(
        `Selected work ${w.workCode}: ${w.workType}. State ${w.state}; IDA ${w.ida}; member ${w.mpName} (${w.chamber}); constituency ${w.constituency ?? "n/a"}; completed ${w.completionDate}; amount ${w.amount === null ? "missing" : `₹${Math.round(w.amount).toLocaleString("en-IN")}`}; photo ${w.hasImage ? "present" : "absent"}; description: ${w.description ?? "missing"}.`,
        `Risk score ${w.risk}/100 (${w.severity}). Indicators: ${d.flags.length ? d.flags.map((f) => `${f.title} (+${f.points}): ${f.explanation}`).join(" | ") : "none"}.`,
        `Review status: ${d.review.status}${d.review.note ? `; reviewer note: ${d.review.note}` : ""}.`,
      );
    }
  }
  return lines.join("\n").slice(0, 5000);
}
