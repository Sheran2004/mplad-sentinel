import { useState } from "react";
import { changePassword } from "@/lib/auth-api";
import type { Copy } from "@/lib/i18n";
import { Card, ErrorNote, inputCls } from "./ui";

export function AccountDialog({ t, email, onClose }: { t: Copy; email: string; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setMsg(null);
    try { await changePassword({ data: { current, next } }); setMsg({ ok: true, text: t.x.acct.done }); setCurrent(""); setNext(""); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" }); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <Card title={t.x.acct.change}>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <p className="text-xs text-muted">{email}</p>
            <input className={inputCls} type="password" autoComplete="current-password" placeholder={t.x.acct.current} value={current} onChange={(e) => setCurrent(e.target.value)} required />
            <input className={inputCls} type="password" autoComplete="new-password" placeholder={t.x.acct.next} value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />
            {msg && (msg.ok ? <p className="text-sm text-ok">{msg.text}</p> : <ErrorNote message={msg.text} />)}
            <div className="flex gap-2">
              <button className={`${inputCls} flex-1 bg-gold font-semibold text-gold-ink`} disabled={busy} type="submit">{t.x.acct.save}</button>
              <button className={inputCls} type="button" onClick={onClose}>{t.x.acct.close}</button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
