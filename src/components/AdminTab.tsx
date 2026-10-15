import { useState } from "react";
import { listAudit, listUsers, saveUser } from "@/lib/auth-api";
import type { Copy } from "@/lib/i18n";
import { Card, ErrorNote, inputCls, useAsync } from "./ui";

const ROLE_LIST = ["viewer", "reviewer", "admin"] as const;

export function AdminTab({ t }: { t: Copy }) {
  const [rev, setRev] = useState(0);
  const users = useAsync(() => listUsers(), [rev]);
  const audit = useAsync(() => listAudit(), [rev]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "reviewer" as (typeof ROLE_LIST)[number] });
  const [err, setErr] = useState<string | null>(null);

  async function act(payload: { id?: string; email?: string; name?: string; role?: (typeof ROLE_LIST)[number]; password?: string; disabled?: boolean }) {
    setErr(null);
    try { await saveUser({ data: payload }); setRev((n) => n + 1); return true; }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); return false; }
  }

  return (
    <div className="grid gap-4">
      {(users.error || audit.error) && <ErrorNote message={users.error ?? audit.error ?? ""} />}
      {err && <ErrorNote message={err} />}
      <Card title={t.auth.users}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted uppercase"><tr><th className="py-2">{t.auth.name}</th><th>{t.auth.email}</th><th>{t.auth.role}</th><th>{t.auth.last}</th><th /></tr></thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="py-2">{u.name}{u.disabled && <span className="ml-2 text-xs text-danger">{t.auth.disabled}</span>}</td>
                  <td>{u.email}</td>
                  <td><select className={inputCls} value={u.role} onChange={(e) => void act({ id: u.id, role: e.target.value as (typeof ROLE_LIST)[number] })}>{ROLE_LIST.map((r) => <option key={r}>{r}</option>)}</select></td>
                  <td className="text-xs text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                  <td className="flex gap-2 py-1">
                    <button className={inputCls} onClick={() => void act({ id: u.id, disabled: !u.disabled })}>{u.disabled ? t.auth.enable : t.auth.disable}</button>
                    <button className={inputCls} onClick={() => { const p = window.prompt(`${t.auth.resetPw}: ${u.email}`); if (p) void act({ id: u.id, password: p }); }}>{t.auth.resetPw}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="mt-4 grid gap-2 md:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); if (await act(form)) setForm({ ...form, name: "", email: "", password: "" }); }}>
          <input className={inputCls} placeholder={t.auth.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className={inputCls} type="email" placeholder={t.auth.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className={inputCls} type="password" autoComplete="new-password" placeholder={`${t.auth.password} (10+)`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as (typeof ROLE_LIST)[number] })}>{ROLE_LIST.map((r) => <option key={r}>{r}</option>)}</select>
          <button className={`${inputCls} bg-gold font-semibold text-gold-ink`} type="submit">{t.auth.create}</button>
        </form>
      </Card>
      <Card title={t.auth.audit}>
        <ul className="divide-y divide-line text-sm">
          {audit.data?.map((a, i) => (
            <li key={i} className="py-2"><span className="text-muted">{new Date(a.at).toLocaleString()}</span> · <span className="font-medium">{a.user ?? "system"}</span> · {a.action}{a.workCode ? ` · ${a.workCode}` : ""}<div className="truncate text-xs text-muted">{a.detail}</div></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
