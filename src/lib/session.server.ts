import { randomUUID, randomBytes } from "node:crypto";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import type { Sql } from "./db.ts";
import { hasRole, hashPassword, signToken, validateEmail, validatePassword, verifyPassword, verifyToken, type Role } from "./session-core.ts";

export type Actor = { id: string; email: string; name: string; role: Role };
const COOKIE = "mplad_session";
const isProd = () => process.env.NODE_ENV === "production";

const g = globalThis as typeof globalThis & { __mpladSecret__?: string; __mpladBoot__?: Promise<void>; __mpladFails__?: Map<string, { n: number; until: number }> };

function secret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (isProd()) throw new Error("SESSION_SECRET (32+ characters) must be set in production.");
  g.__mpladSecret__ ??= randomBytes(32).toString("hex"); // dev only: sessions end when the server restarts
  return g.__mpladSecret__;
}

export const requireLogin = () => process.env.REQUIRE_LOGIN?.trim().toLowerCase() === "true";

type UserRow = { id: string; email: string; name: string; role: Role; password_hash: string; disabled: boolean };

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

export async function accountsExist(sql: Sql): Promise<boolean> {
  return (await sql.query("SELECT 1 FROM mplad_users LIMIT 1")).length > 0;
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

/** Reads: open unless REQUIRE_LOGIN=true. */
export async function assertCanRead(sql: Sql): Promise<Actor | null> {
  const actor = await getActor(sql);
  if (requireLogin() && !actor) throw new Error("Sign in required.");
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
  if (need === "admin" || (await accountsExist(sql)) || requireLogin()) throw new Error("Sign in required.");
  return { id: null, email: "anonymous" };
}

export async function audit(sql: Sql, who: { id: string | null; email: string }, action: string, workCode: string | null, detail: Record<string, unknown> = {}) {
  await sql.query("INSERT INTO mplad_audit_log (user_id, user_email, action, work_code, detail) VALUES ($1, $2, $3, $4, $5::jsonb)", [
    who.id, who.email, action, workCode, JSON.stringify(detail),
  ]);
}

export async function login(sql: Sql, emailRaw: unknown, passwordRaw: unknown): Promise<Actor> {
  await assertSameSite();
  const email = validateEmail(emailRaw);
  const password = String(passwordRaw ?? "").slice(0, 200);
  const ip = (() => { try { return getRequestIP({ xForwardedFor: true }) ?? "?"; } catch { return "?"; } })();
  const key = `${email}|${ip}`;
  g.__mpladFails__ ??= new Map();
  const fail = g.__mpladFails__.get(key);
  if (fail && fail.n >= 5 && fail.until > Date.now()) throw new Error("Too many failed attempts. Try again in a few minutes.");

  const rows = await sql.query<UserRow>("SELECT id, email, name, role, password_hash, disabled FROM mplad_users WHERE email = $1", [email]);
  const u = rows[0];
  // Always run a hash comparison so timing doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, u?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!u || u.disabled || !ok) {
    g.__mpladFails__.set(key, { n: (fail && fail.until > Date.now() ? fail.n : 0) + 1, until: Date.now() + 10 * 60_000 });
    await audit(sql, { id: null, email }, "login_failed", null);
    throw new Error("Incorrect email or password.");
  }
  g.__mpladFails__.delete(key);
  await sql.query("UPDATE mplad_users SET last_login_at = NOW() WHERE id = $1", [u.id]);
  setCookie(COOKIE, signToken(u.id, secret()), { httpOnly: true, sameSite: "lax", secure: isProd(), path: "/", maxAge: 7 * 86_400 });
  await audit(sql, { id: u.id, email: u.email }, "login", null);
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export function logout() {
  deleteCookie(COOKIE, { path: "/" });
}
