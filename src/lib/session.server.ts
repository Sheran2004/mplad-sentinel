import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import type { Sql } from "./db.ts";
import { hasRole, hashPassword, signToken, validateEmail, validatePassword, verifyPassword, verifyToken, type Role } from "./session-core.ts";

export type Actor = { id: string; email: string; name: string; role: Role };
const COOKIE = "mplad_session";
const isProd = () => process.env.NODE_ENV === "production";

const g = globalThis as typeof globalThis & { __mpladSecret__?: string; __mpladBoot__?: Promise<void> };

function secret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (isProd()) throw new Error("SESSION_SECRET (32+ characters) must be set in production.");
  g.__mpladSecret__ ??= randomBytes(32).toString("hex"); // dev only: sessions end when the server restarts
  return g.__mpladSecret__;
}

type UserRow = { id: string; email: string; name: string; role: Role; password_hash: string; disabled: boolean };

function clientIp(): string {
  try { return getRequestIP({ xForwardedFor: true }) ?? "unknown"; } catch { return "unknown"; }
}

export async function accountsExist(sql: Sql): Promise<boolean> {
  return (await sql.query("SELECT 1 FROM mplad_users LIMIT 1")).length > 0;
}

/**
 * Sign-in is required to view data as soon as any account exists (REQUIRE_LOGIN=false opts out,
 * REQUIRE_LOGIN=true forces it even before the first account exists).
 */
export async function loginRequired(sql: Sql): Promise<boolean> {
  const v = process.env.REQUIRE_LOGIN?.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return accountsExist(sql);
}

/** Self-service sign-up needs an active admin (so accounts can be promoted) and ALLOW_REGISTRATION != false. */
export async function registrationOpen(sql: Sql): Promise<boolean> {
  if (process.env.ALLOW_REGISTRATION?.trim().toLowerCase() === "false") return false;
  return (await sql.query("SELECT 1 FROM mplad_users WHERE role = 'admin' AND disabled = FALSE LIMIT 1")).length > 0;
}

export const inviteCodeRequired = () => Boolean(process.env.REGISTRATION_CODE?.trim());

/** Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when that account does not exist yet. */
export function ensureBootstrap(sql: Sql): Promise<void> {
  g.__mpladBoot__ ??= (async () => {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    const exists = await sql.query("SELECT 1 FROM mplad_users WHERE email = $1", [validateEmail(email)]);
    if (exists.length) return;
    await sql.query("INSERT INTO mplad_users (id, email, name, role, password_hash) VALUES ($1, $2, $3, 'admin', $4)", [
      randomUUID(), email, "Administrator", await hashPassword(validatePassword(password)),
    ]);
    console.log(`[auth] created admin ${email}`);
  })().catch((e) => { g.__mpladBoot__ = undefined; throw e; });
  return g.__mpladBoot__;
}

export async function getActor(sql: Sql): Promise<Actor | null> {
  const uid = verifyToken(getCookie(COOKIE), secret());
  if (!uid) return null;
  const rows = await sql.query<UserRow>("SELECT id, email, name, role, password_hash, disabled FROM mplad_users WHERE id = $1", [uid]);
  const u = rows[0];
  return u && !u.disabled ? { id: u.id, email: u.email, name: u.name, role: u.role } : null;
}

export async function assertSameSite() {
  const { assertSameSiteRequest } = await import("./auth/isolation.server");
  assertSameSiteRequest();
}

/** Reads need a signed-in user once any account exists (see loginRequired). */
export async function assertCanRead(sql: Sql): Promise<Actor | null> {
  const actor = await getActor(sql);
  if (!actor && (await loginRequired(sql))) throw new Error("Sign in required.");
  return actor;
}

/**
 * Writes: when no accounts exist yet the app is in open (local/dev) mode and writes are attributed to "anonymous".
 * Once any account exists, a signed-in reviewer or admin is required.
 */
export async function assertCanWrite(sql: Sql, need: Role = "reviewer"): Promise<{ id: string | null; email: string }> {
  await assertSameSite();
  const actor = await getActor(sql);
  if (actor) {
    if (!hasRole(actor.role, need)) throw new Error(`This action needs the ${need} role.`);
    return { id: actor.id, email: actor.email };
  }
  if (need === "admin" || (await accountsExist(sql)) || (await loginRequired(sql))) throw new Error("Sign in required.");
  return { id: null, email: "anonymous" };
}

export async function audit(sql: Sql, who: { id: string | null; email: string }, action: string, workCode: string | null, detail: Record<string, unknown> = {}) {
  await sql.query("INSERT INTO mplad_audit_log (user_id, user_email, action, work_code, detail) VALUES ($1, $2, $3, $4, $5::jsonb)", [
    who.id, who.email, action, workCode, JSON.stringify(detail),
  ]);
}

function startSession(userId: string) {
  setCookie(COOKIE, signToken(userId, secret()), { httpOnly: true, sameSite: "lax", secure: isProd(), path: "/", maxAge: 7 * 86_400 });
}

const LOCK_AFTER = 5;

export async function login(sql: Sql, emailRaw: unknown, passwordRaw: unknown): Promise<Actor> {
  await assertSameSite();
  const email = validateEmail(emailRaw);
  const password = String(passwordRaw ?? "").slice(0, 200);

  // Failed attempts in the last 10 minutes since the last successful login. Kept in the DB so the limit
  // holds across serverless instances.
  const fails = await sql.query<{ n: number }>(
    `SELECT count(*) AS n FROM mplad_audit_log
     WHERE action = 'login_failed' AND user_email = $1 AND at > NOW() - INTERVAL '10 minutes'
       AND at > COALESCE((SELECT max(at) FROM mplad_audit_log WHERE action = 'login' AND user_email = $1), 'epoch'::timestamptz)`,
    [email],
  );
  if (Number(fails[0]?.n ?? 0) >= LOCK_AFTER) throw new Error("Too many failed attempts. Try again in a few minutes.");

  const rows = await sql.query<UserRow>("SELECT id, email, name, role, password_hash, disabled FROM mplad_users WHERE email = $1", [email]);
  const u = rows[0];
  // Always run a hash comparison so timing doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, u?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!u || u.disabled || !ok) {
    await audit(sql, { id: null, email }, "login_failed", null);
    throw new Error("Incorrect email or password.");
  }
  await sql.query("UPDATE mplad_users SET last_login_at = NOW() WHERE id = $1", [u.id]);
  startSession(u.id);
  await audit(sql, { id: u.id, email: u.email }, "login", null);
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/** Self-service sign-up. New accounts are read-only (viewer) until an admin promotes them. */
export async function register(sql: Sql, input: { name: unknown; email: unknown; password: unknown; code: unknown }): Promise<Actor> {
  await assertSameSite();
  if (!(await registrationOpen(sql))) throw new Error("Sign-up is closed. Ask an administrator for an account.");
  const ip = clientIp();
  const recent = await sql.query<{ n: number }>(
    `SELECT count(*) AS n FROM mplad_audit_log
     WHERE action IN ('registered', 'register_failed') AND detail->>'ip' = $1 AND at > NOW() - INTERVAL '1 hour'`,
    [ip],
  );
  if (Number(recent[0]?.n ?? 0) >= 8) throw new Error("Too many sign-up attempts from this network. Try again later.");

  const fail = async (message: string): Promise<never> => {
    await audit(sql, { id: null, email: "anonymous" }, "register_failed", null, { ip, reason: message.slice(0, 80) });
    throw new Error(message);
  };
  const need = process.env.REGISTRATION_CODE?.trim();
  if (need) {
    const a = Buffer.from(String(input.code ?? "").trim());
    const b = Buffer.from(need);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("Invalid invite code.");
  }
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) return fail("Enter your name (2 to 120 characters).");
  let email: string;
  let password: string;
  try {
    email = validateEmail(input.email);
    password = validatePassword(input.password);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Invalid details.");
  }
  if ((await sql.query("SELECT 1 FROM mplad_users WHERE email = $1", [email])).length) return fail("An account with this email already exists. Try signing in.");

  const id = randomUUID();
  await sql.query("INSERT INTO mplad_users (id, email, name, role, password_hash, last_login_at) VALUES ($1, $2, $3, 'viewer', $4, NOW())", [
    id, email, name, await hashPassword(password),
  ]);
  startSession(id);
  await audit(sql, { id, email }, "registered", null, { ip });
  return { id, email, name, role: "viewer" };
}

/** Signed-in users change their own password. Wrong current passwords count toward the login lockout. */
export async function changeOwnPassword(sql: Sql, currentRaw: unknown, nextRaw: unknown): Promise<void> {
  await assertSameSite();
  const actor = await getActor(sql);
  if (!actor) throw new Error("Sign in required.");
  const fails = await sql.query<{ n: number }>(
    "SELECT count(*) AS n FROM mplad_audit_log WHERE action = 'login_failed' AND user_email = $1 AND at > NOW() - INTERVAL '10 minutes'",
    [actor.email],
  );
  if (Number(fails[0]?.n ?? 0) >= LOCK_AFTER) throw new Error("Too many failed attempts. Try again in a few minutes.");
  const next = validatePassword(nextRaw);
  const rows = await sql.query<{ password_hash: string }>("SELECT password_hash FROM mplad_users WHERE id = $1", [actor.id]);
  if (!rows[0] || !(await verifyPassword(String(currentRaw ?? "").slice(0, 200), rows[0].password_hash))) {
    await audit(sql, { id: null, email: actor.email }, "login_failed", null, { via: "change_password" });
    throw new Error("Current password is incorrect.");
  }
  await sql.query("UPDATE mplad_users SET password_hash = $2 WHERE id = $1", [actor.id, await hashPassword(next)]);
  await audit(sql, { id: actor.id, email: actor.email }, "password_changed", null);
}

export function logout() {
  deleteCookie(COOKIE, { path: "/" });
}
