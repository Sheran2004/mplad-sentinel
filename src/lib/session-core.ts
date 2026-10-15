import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

export type Role = "admin" | "reviewer" | "viewer";
export const ROLES: Role[] = ["admin", "reviewer", "viewer"];
const RANK: Record<Role, number> = { viewer: 1, reviewer: 2, admin: 3 };
export const hasRole = (have: Role | undefined, need: Role) => (have ? RANK[have] >= RANK[need] : false);

export const MIN_PASSWORD = 10;
export const SESSION_DAYS = 7;

export function validateEmail(v: unknown): string {
  const e = String(v ?? "").trim().toLowerCase();
  if (e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Enter a valid email address.");
  return e;
}

export function validatePassword(v: unknown): string {
  const p = String(v ?? "");
  if (p.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
  if (p.length > 200) throw new Error("Password is too long.");
  return p;
}

const scrypt = (password: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, len, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? reject(e) : resolve(k))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltB64, keyB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Stateless signed token: base64url(payload).hmac. The user row is re-read on every request. */
export function signToken(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: now + SESSION_DAYS * 86_400_000 })).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyToken(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const good = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(good);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: string; exp?: number };
    return typeof u === "string" && typeof exp === "number" && exp > now ? u : null;
  } catch {
    return null;
  }
}
