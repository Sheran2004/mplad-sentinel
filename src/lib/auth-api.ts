import { createServerFn } from "@tanstack/react-start";
import { ROLES, type Role } from "./session-core";

async function ready() {
  const [{ getSql }, s] = await Promise.all([import("./db"), import("./session.server")]);
  const sql = await getSql();
  await s.ensureBootstrap(sql);
  return { sql, s };
}

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { sql, s } = await ready();
  const user = await s.getActor(sql);
  const accounts = await s.accountsExist(sql);
  const required = await s.loginRequired(sql);
  return {
    user, accountsConfigured: accounts, requireLogin: required,
    registrationOpen: await s.registrationOpen(sql), inviteCodeRequired: s.inviteCodeRequired(),
    canWrite: user ? user.role !== "viewer" : !accounts && !required,
  };
});

export const signIn = createServerFn({ method: "POST" })
  .validator((i: unknown) => {
    const v = (i ?? {}) as { email?: unknown; password?: unknown };
    return { email: String(v.email ?? ""), password: String(v.password ?? "") };
  })
  .handler(async ({ data }) => {
    const { sql, s } = await ready();
    return s.login(sql, data.email, data.password);
  });

export const registerAccount = createServerFn({ method: "POST" })
  .validator((i: unknown) => {
    const v = (i ?? {}) as Record<string, unknown>;
    return { name: String(v.name ?? "").slice(0, 200), email: String(v.email ?? "").slice(0, 250), password: String(v.password ?? "").slice(0, 250), code: String(v.code ?? "").slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const { sql, s } = await ready();
    return s.register(sql, data);
  });

export const changePassword = createServerFn({ method: "POST" })
  .validator((i: unknown) => {
    const v = (i ?? {}) as Record<string, unknown>;
    return { current: String(v.current ?? "").slice(0, 250), next: String(v.next ?? "").slice(0, 250) };
  })
  .handler(async ({ data }) => {
    const { sql, s } = await ready();
    await s.changeOwnPassword(sql, data.current, data.next);
    return { ok: true as const };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { s } = await ready();
  await s.assertSameSite();
  s.logout();
  return { ok: true as const };
});

export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { sql, s } = await ready();
  await s.assertCanWrite(sql, "admin");
  const rows = await sql.query<{ id: string; email: string; name: string; role: Role; disabled: boolean; created_at: string | Date; last_login_at: string | Date | null }>(
    "SELECT id, email, name, role, disabled, created_at, last_login_at FROM mplad_users ORDER BY created_at",
  );
  const iso = (v: string | Date | null) => (v === null ? null : v instanceof Date ? v.toISOString() : String(v));
  return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, role: r.role, disabled: r.disabled, createdAt: iso(r.created_at), lastLoginAt: iso(r.last_login_at) }));
});

type SaveUser = { id?: string; email?: string; name?: string; role?: Role; password?: string; disabled?: boolean };

export const saveUser = createServerFn({ method: "POST" })
  .validator((i: unknown): SaveUser => {
    const v = (i ?? {}) as Record<string, unknown>;
    const role = v.role === undefined ? undefined : ROLES.find((r) => r === v.role);
    if (v.role !== undefined && !role) throw new Error("Invalid role.");
    return {
      id: typeof v.id === "string" ? v.id.slice(0, 80) : undefined,
      email: typeof v.email === "string" ? v.email : undefined,
      name: typeof v.name === "string" ? v.name.trim().slice(0, 120) : undefined,
      role, password: typeof v.password === "string" ? v.password : undefined,
      disabled: typeof v.disabled === "boolean" ? v.disabled : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { sql, s } = await ready();
    const who = await s.assertCanWrite(sql, "admin");
    const { hashPassword, validateEmail, validatePassword } = await import("./session-core");
    const { randomUUID } = await import("node:crypto");
    if (!data.id) {
      const email = validateEmail(data.email);
      const password = validatePassword(data.password);
      if (!data.name) throw new Error("Name is required.");
      const dup = await sql.query("SELECT 1 FROM mplad_users WHERE email = $1", [email]);
      if (dup.length) throw new Error("A user with this email already exists.");
      const id = randomUUID();
      await sql.query("INSERT INTO mplad_users (id, email, name, role, password_hash) VALUES ($1,$2,$3,$4,$5)", [id, email, data.name, data.role ?? "viewer", await hashPassword(password)]);
      await s.audit(sql, who, "user_created", null, { email, role: data.role ?? "viewer" });
      return { ok: true as const, id };
    }
    const cur = await sql.query<{ role: Role; disabled: boolean }>("SELECT role, disabled FROM mplad_users WHERE id = $1", [data.id]);
    if (!cur[0]) throw new Error("User not found.");
    // Never let the last active admin be demoted or disabled.
    const demoting = (data.role && data.role !== "admin") || data.disabled === true;
    if (cur[0].role === "admin" && !cur[0].disabled && demoting) {
      const n = await sql.query<{ n: number }>("SELECT count(*) AS n FROM mplad_users WHERE role = 'admin' AND disabled = FALSE");
      if (Number(n[0].n) <= 1) throw new Error("At least one active admin is required.");
    }
    if (data.role) await sql.query("UPDATE mplad_users SET role = $2 WHERE id = $1", [data.id, data.role]);
    if (data.disabled !== undefined) await sql.query("UPDATE mplad_users SET disabled = $2 WHERE id = $1", [data.id, data.disabled]);
    if (data.name) await sql.query("UPDATE mplad_users SET name = $2 WHERE id = $1", [data.id, data.name]);
    if (data.password) await sql.query("UPDATE mplad_users SET password_hash = $2 WHERE id = $1", [data.id, await hashPassword(validatePassword(data.password))]);
    await s.audit(sql, who, "user_updated", null, { id: data.id, role: data.role, disabled: data.disabled, passwordReset: Boolean(data.password) });
    return { ok: true as const, id: data.id };
  });

export const listAudit = createServerFn({ method: "GET" }).handler(async () => {
  const { sql, s } = await ready();
  await s.assertCanWrite(sql, "admin");
  const rows = await sql.query<{ at: string | Date; user_email: string | null; action: string; work_code: string | null; detail: unknown }>(
    "SELECT at, user_email, action, work_code, detail FROM mplad_audit_log ORDER BY id DESC LIMIT 150",
  );
  return rows.map((r) => ({ at: r.at instanceof Date ? r.at.toISOString() : String(r.at), user: r.user_email, action: r.action, workCode: r.work_code, detail: JSON.stringify(r.detail ?? {}) }));
});
