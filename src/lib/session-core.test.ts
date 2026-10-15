import assert from "node:assert/strict";
import { test } from "node:test";
import { hasRole, hashPassword, signToken, validateEmail, validatePassword, verifyPassword, verifyToken } from "./session-core.ts";

test("password hashing round-trips and rejects wrong passwords", async () => {
  const h = await hashPassword("correct horse battery");
  assert.ok(h.startsWith("scrypt$"));
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("wrong password!!", h), false);
  assert.equal(await verifyPassword("x", "garbage"), false);
});

test("session tokens are signed, expire and resist tampering", () => {
  const secret = "s".repeat(40);
  const t = signToken("user-1", secret, 1_000);
  assert.equal(verifyToken(t, secret, 2_000), "user-1");
  assert.equal(verifyToken(t, "o".repeat(40), 2_000), null);
  assert.equal(verifyToken(t, secret, 1_000 + 8 * 86_400_000), null);
  const [p, m] = t.split(".");
  assert.equal(verifyToken(`${Buffer.from('{"u":"admin","exp":9999999999999}').toString("base64url")}.${m}`, secret, 2_000), null);
  assert.equal(verifyToken(undefined, secret), null);
  assert.equal(verifyToken(`${p}`, secret), null);
});

test("validation and roles", () => {
  assert.equal(validateEmail(" A@B.com "), "a@b.com");
  assert.throws(() => validateEmail("nope"));
  assert.throws(() => validatePassword("short"));
  assert.equal(hasRole("admin", "reviewer"), true);
  assert.equal(hasRole("viewer", "reviewer"), false);
  assert.equal(hasRole(undefined, "viewer"), false);
});
