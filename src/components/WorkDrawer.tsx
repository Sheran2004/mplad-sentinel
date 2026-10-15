import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { getWorkDetail } from "@/lib/api";
import { saveReviewNote, saveReviewStatus } from "@/lib/reviews";
import type { Copy } from "@/lib/i18n";
import { inrFull } from "@/lib/format";
import { ErrorNote, SeverityPill, inputCls, useAsync } from "./ui";

const STATUSES = ["open", "reviewed", "dismissed"] as const;

export function WorkDrawer({ code, t, canWrite, signedIn, onNeedLogin, onClose, onAsk }: { code: string; t: Copy; canWrite: boolean; signedIn: boolean; onNeedLogin: () => void; onClose: () => void; onAsk: (code: string) => void }) {
  const [rev, setRev] = useState(0);
  const detail = useAsync(() => getWorkDetail({ data: { workCode: code } }), [code, rev]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const d = detail.data;

  useEffect(() => { if (d) setNote(d.review.note); }, [d]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<unknown>) {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: "ok", text: t.detail.saved });
      setRev((n) => n + 1);
    } catch (e) { setMsg({ kind: "err", text: e instanceof Error ? e.message : "Save failed" }); }
  }

  const w = d?.work;
  const fields: [string, string][] = w ? [
    ["Work code", w.workCode], ["Financial year", w.fy], ["Category", w.category], ["State", w.state], ["Implementing authority", w.ida],
    ["Member", `${w.mpName} (${w.chamber === "LS" ? "Lok Sabha" : w.chamber === "RS" ? "Rajya Sabha" : "unknown"})`],
    ["Constituency", w.constituency ?? "Not available"], ["Completed", w.completionDate],
    ["Amount disbursed", inrFull(w.amount)], ["Photo on record", w.hasImage ? "Yes" : "No"],
  ] : [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose} role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-bg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{w?.workType ?? code}</h2>
            {w && <div className="mt-1"><SeverityPill severity={w.severity} risk={w.risk} /></div>}
          </div>
          <button aria-label={t.detail.close} onClick={onClose} className="rounded-lg p-2 hover:bg-surface-2"><X size={18} /></button>
        </div>
        {detail.error && <div className="mt-4"><ErrorNote message={detail.error} /></div>}
        {detail.loading && !d && <p className="mt-4 text-muted">{t.loading}</p>}
        {d && w && (
          <div className="mt-4 grid gap-5">
            {w.description && <p className="text-sm">{w.description}</p>}
            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted uppercase">{t.detail.why}</h3>
              {d.flags.length === 0 ? <p className="text-sm text-muted">{t.detail.none}</p> : (
                <ul className="grid gap-2">
                  {d.flags.map((f) => (
                    <li key={f.code} className="rounded-lg border border-line bg-surface p-3 text-sm">
                      <div className="flex justify-between gap-2 font-medium"><span>{f.title}</span><span className="text-muted">+{f.points}</span></div>
                      <p className="mt-1 text-muted">{f.explanation}</p>
                      {Array.isArray((f.evidence as unknown as { others?: unknown[] }).others) && (
                        <p className="mt-1 text-xs text-muted">Compare with: {((f.evidence as unknown as { others: { workCode: string }[] }).others).map((o) => o.workCode).join(", ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted uppercase">{t.detail.fields}</h3>
              <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1 text-sm">
                {fields.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="break-words">{v}</dd></div>))}
              </dl>
            </section>
            <section className="grid gap-2">
              <h3 className="text-xs font-semibold text-muted uppercase">{t.detail.status}</h3>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button key={s} disabled={!canWrite} className={`${inputCls} ${d.review.status === s ? "border-gold text-gold" : ""}`}
                    onClick={() => run(() => saveReviewStatus({ data: { workId: code, status: s } }))}>{t.detail[s]}</button>
                ))}
              </div>
              {!canWrite && (
                <p className="text-sm text-muted">{signedIn ? t.detail.readOnly : t.detail.needLogin}{!signedIn && <> <button className="text-gold underline" onClick={onNeedLogin}>{t.auth.signIn}</button></>}</p>
              )}
              <textarea disabled={!canWrite} className="min-h-24 rounded-lg border border-line bg-surface-2 p-3 text-sm outline-none focus:border-gold" placeholder={t.detail.note} value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} />
              <div className="flex items-center gap-3">
                <button disabled={!canWrite} className={`${inputCls} bg-gold text-gold-ink`} onClick={() => run(() => saveReviewNote({ data: { workId: code, note } }))}>{t.detail.save}</button>
                {msg && <span className={`text-sm ${msg.kind === "ok" ? "text-ok" : "text-danger"}`}>{msg.text}</span>}
              </div>
              {d.events.length > 0 && (
                <div className="text-xs text-muted"><p className="mt-2 font-semibold">{t.detail.history}</p>
                  {d.events.map((e, i) => <p key={i}>{new Date(e.at).toLocaleString()} · {e.from ?? "open"} → {e.to}</p>)}
                </div>
              )}
            </section>
            <button className={`${inputCls} flex items-center justify-center gap-2`} onClick={() => onAsk(code)}><MessageCircle size={15} />{t.detail.ask}</button>
          </div>
        )}
      </aside>
    </div>
  );
}
