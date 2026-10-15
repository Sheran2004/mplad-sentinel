import { useState } from "react";
import { signIn } from "@/lib/auth-api";
import type { Copy } from "@/lib/i18n";
import { Card, ErrorNote, inputCls } from "./ui";

export function LoginForm({ t, onDone }: { t: Copy; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr(null);
    try { await signIn({ data: { email, password } }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Sign in failed"); }
    finally { setBusy(false); }
  }
  return (
    <Card title={t.auth.title} className="mx-auto max-w-sm">
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <input className={inputCls} type="email" autoComplete="username" placeholder={t.auth.email} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={inputCls} type="password" autoComplete="current-password" placeholder={t.auth.password} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <ErrorNote message={err} />}
        <button className={`${inputCls} bg-gold font-semibold text-gold-ink`} disabled={busy} type="submit">{t.auth.signIn}</button>
      </form>
    </Card>
  );
}
