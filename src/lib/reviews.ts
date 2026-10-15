import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";

type ReviewStatus = "open" | "reviewed" | "dismissed";
type SaveReviewInput = { workId: string; status: ReviewStatus };
type SaveNoteInput = { workId: string; note: string };

function cleanWorkId(value: unknown): string {
  const workId = String(value ?? "").trim().slice(0, 120);
  if (!workId) throw new Error("A work ID is required.");
  return workId;
}

function cleanSaveInput(input: unknown): SaveReviewInput {
  const value = (input ?? {}) as Partial<SaveReviewInput>;
  const status = value.status;
  if (status !== "open" && status !== "reviewed" && status !== "dismissed") throw new Error("Invalid review status.");
  return { workId: cleanWorkId(value.workId), status };
}

function cleanNoteInput(input: unknown): SaveNoteInput {
  const value = (input ?? {}) as Partial<SaveNoteInput>;
  return { workId: cleanWorkId(value.workId), note: String(value.note ?? "").trim().slice(0, 5000) };
}

async function guardedWrite(workId: string) {
  const sql = await getSql();
  const { assertCanWrite } = await import("./session.server");
  const who = await assertCanWrite(sql, "reviewer");
  const rows = await sql.query("SELECT 1 FROM mplad_works WHERE work_code = $1", [workId]);
  if (!rows.length) throw new Error(`Unknown work code ${workId}.`);
  return { sql, who };
}

export const saveReviewStatus = createServerFn({ method: "POST" })
  .validator(cleanSaveInput)
  .handler(async ({ data }) => {
    const { sql, who } = await guardedWrite(data.workId);
    const { audit } = await import("./session.server");
    const previous = await sql.query<{ status: ReviewStatus }>("SELECT status FROM mplad_case_reviews WHERE work_id = $1", [data.workId]);
    await sql.query(
      `INSERT INTO mplad_case_reviews (work_id, status, updated_at, updated_by) VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (work_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [data.workId, data.status, who.email],
    );
    if ((previous[0]?.status ?? "open") !== data.status) {
      await sql.query("INSERT INTO mplad_case_review_events (work_id, previous_status, new_status, user_email) VALUES ($1, $2, $3, $4)", [
        data.workId, previous[0]?.status ?? null, data.status, who.email,
      ]);
      await audit(sql, who, "status_changed", data.workId, { from: previous[0]?.status ?? "open", to: data.status });
    }
    return { ok: true as const, workId: data.workId, status: data.status };
  });

export const saveReviewNote = createServerFn({ method: "POST" })
  .validator(cleanNoteInput)
  .handler(async ({ data }) => {
    const { sql, who } = await guardedWrite(data.workId);
    const { audit } = await import("./session.server");
    await sql.query(
      `INSERT INTO mplad_case_reviews (work_id, status, note, updated_at, updated_by) VALUES ($1, 'open', $2, NOW(), $3)
       ON CONFLICT (work_id) DO UPDATE SET note = EXCLUDED.note, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [data.workId, data.note, who.email],
    );
    await audit(sql, who, "note_saved", data.workId, { length: data.note.length });
    return { ok: true as const, workId: data.workId };
  });
