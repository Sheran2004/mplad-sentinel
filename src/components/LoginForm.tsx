import { useState } from "react";
import { registerAccount, signIn } from "@/lib/auth-api";
import type { Copy } from "@/lib/i18n";
import { Card, ErrorNote, inputCls } from "./ui";

export function LoginForm({ t, onDone, registrationOpen, inviteCodeRequired }: { t: Copy; onDone: () => void; registrationOpen: boolean; inviteCodeRequired: boolean }) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (registering) await registerAccount({ data: { name, email, password, code } });
      else await signIn({ data: { email, password } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card title={registering ? t.auth.createAccount : t.auth.title} className="mx-auto max-w-sm">
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {registering && <input className={inputCls} autoComplete="name" placeholder={t.auth.fullName} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />}
        <input className={inputCls} type="email" autoComplete="username" placeholder={t.auth.email} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={inputCls} type="password" autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? `${t.auth.password} (10+)` : t.auth.password} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={registering ? 10 : 1} />
        {registering && inviteCodeRequired && <input className={inputCls} placeholder={t.auth.code} value={code} onChange={(e) => setCode(e.target.value)} required />}
        {registering && <p className="text-xs text-muted">{t.auth.registerHint}</p>}
        {err && <ErrorNote message={err} />}
        <button className={`${inputCls} bg-gold font-semibold text-gold-ink`} disabled={busy} type="submit">{registering ? t.auth.createAccount : t.auth.signIn}</button>
        {registrationOpen && (
          <button type="button" className="text-sm text-gold underline" onClick={() => { setErr(null); setMode(registering ? "signin" : "register"); }}>
            {registering ? t.auth.toSignIn : t.auth.toRegister}
          </button>
        )}
      </form>
    </Card>
  );
}
