import { createServerFn } from "@tanstack/react-start";
import type { MpFilter, WorksFilter } from "./dataset/queries.server.ts";

/** Server functions: the only way the browser reaches the database. Each call is validated and parameterized. */

const text = (v: unknown, max = 200) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || undefined;
};
const numberOrUndef = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

function cleanFilter(input: unknown): WorksFilter {
  const i = (input ?? {}) as Record<string, unknown>;
  return {
    q: text(i.q, 120), state: text(i.state), workType: text(i.workType, 300), fy: text(i.fy, 20), severity: text(i.severity, 20),
    flag: text(i.flag, 40), mpKey: text(i.mpKey, 120),
    photo: i.photo === "yes" || i.photo === "no" ? i.photo : undefined,
    minAmount: numberOrUndef(i.minAmount), maxAmount: numberOrUndef(i.maxAmount),
    sort: i.sort === "amount" || i.sort === "date" ? i.sort : "risk", dir: i.dir === "asc" ? "asc" : "desc",
    page: numberOrUndef(i.page), pageSize: numberOrUndef(i.pageSize),
  };
}

function cleanMpFilter(input: unknown): MpFilter {
  const i = (input ?? {}) as Record<string, unknown>;
  const sort = ["works", "flagged", "allocated"].includes(String(i.sort)) ? (i.sort as MpFilter["sort"]) : "disbursed";
  return { q: text(i.q, 120), state: text(i.state), sort, page: numberOrUndef(i.page), pageSize: numberOrUndef(i.pageSize) };
}

async function db() {
  const [{ getSql }, { ensureSeeded }, session] = await Promise.all([import("./db"), import("./dataset/seed.server"), import("./session.server")]);
  const sql = await getSql();
  await ensureSeeded(sql);
  await session.ensureBootstrap(sql);
  await session.assertCanRead(sql);
  return sql;
}

export const getOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { getOverview } = await import("./dataset/queries.server");
  return getOverview(await db());
});

export const getFacets = createServerFn({ method: "GET" }).handler(async () => {
  const { getFacets } = await import("./dataset/queries.server");
  return getFacets(await db());
});

export const searchWorks = createServerFn({ method: "POST" })
  .validator(cleanFilter)
  .handler(async ({ data }) => {
    const { searchWorks } = await import("./dataset/queries.server");
    return searchWorks(await db(), data);
  });

export const getWorkDetail = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const code = text((input as { workCode?: unknown })?.workCode, 120);
    if (!code) throw new Error("A work code is required.");
    return { workCode: code };
  })
  .handler(async ({ data }) => {
    const { getWorkDetail } = await import("./dataset/queries.server");
    return getWorkDetail(await db(), data.workCode);
  });

export const listMembers = createServerFn({ method: "POST" })
  .validator(cleanMpFilter)
  .handler(async ({ data }) => {
    const { listMembers } = await import("./dataset/queries.server");
    return listMembers(await db(), data);
  });

export const exportWorksCsv = createServerFn({ method: "POST" })
  .validator(cleanFilter)
  .handler(async ({ data }) => {
    const { exportWorksCsv } = await import("./dataset/queries.server");
    return exportWorksCsv(await db(), data);
  });

export const listCases = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql.query<{
    work_id: string; status: string; note: string; updated_at: string | Date; work_type: string | null; state: string | null;
    amount: string | null; risk: number | null; severity: string | null;
  }>(
    `SELECT r.work_id, r.status, r.note, r.updated_at, w.work_type, w.state, w.amount, w.risk, w.severity
     FROM mplad_case_reviews r LEFT JOIN mplad_works w ON w.work_code = r.work_id
     WHERE r.status <> 'open' OR r.note <> '' ORDER BY r.updated_at DESC LIMIT 200`,
  );
  return rows.map((r) => ({
    workCode: r.work_id, status: r.status, note: r.note ?? "", updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at), workType: r.work_type, state: r.state,
    amount: r.amount === null ? null : Number(r.amount), risk: r.risk === null ? null : Number(r.risk), severity: r.severity,
  }));
});

export const getAccessInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { dbSource } = await import("./db");
  return {
    aiConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    database: dbSource === "neon" ? "PostgreSQL" : process.env.PGLITE_DIR?.trim() ? "Embedded PGlite (saved on disk)" : "Embedded PGlite (in memory, resets on restart)",
  };
});
