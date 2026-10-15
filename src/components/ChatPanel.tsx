import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { askDesk } from "@/lib/ask";
import type { Copy, Lang } from "@/lib/i18n";
import { inputCls } from "./ui";

type Msg = { role: "user" | "assistant"; text: string; error?: boolean };
const STORE = "mplad-chat-v2";

export function ChatPanel({ t, lang, open, setOpen, workCode, setWorkCode }: {
  t: Copy; lang: Lang; open: boolean; setOpen: (o: boolean) => void; workCode?: string; setWorkCode: (c?: string) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(STORE) || "[]")); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))); } catch { /* ignore */ } end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function send() {
    const message = text.trim();
    if (!message || busy) return;
    setText(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: message }]);
    try {
      const res = await askDesk({ data: { message, lang, workCode } });
      setMsgs((m) => [...m, res.ok ? { role: "assistant", text: res.text } : { role: "assistant", text: res.error, error: true }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "Request failed", error: true }]);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-full bg-gold px-4 py-3 font-semibold text-gold-ink shadow-lg" onClick={() => setOpen(true)}>
        <MessageCircle size={18} />{t.chat.title}
      </button>
    );
  }
  return (
    <div className="fixed right-4 bottom-4 z-50 flex h-[min(620px,calc(100vh-2rem))] w-[min(420px,calc(100vw-2rem))] flex-col rounded-2xl border border-line bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-line p-3">
        <div><p className="font-semibold">{t.chat.title}</p><p className="text-xs text-muted">{workCode ? workCode : t.chat.hint}</p></div>
        <div className="flex gap-1">
          {workCode && <button className="rounded-lg p-2 text-xs hover:bg-surface-2" onClick={() => setWorkCode(undefined)}>{t.chat.newChat}</button>}
          <button aria-label={t.chat.clear} className="rounded-lg p-2 hover:bg-surface-2" onClick={() => setMsgs([])}><Trash2 size={16} /></button>
          <button aria-label={t.detail.close} className="rounded-lg p-2 hover:bg-surface-2" onClick={() => setOpen(false)}><X size={16} /></button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {msgs.length === 0 && <p className="text-muted">{t.chat.hint}</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[92%] rounded-xl px-3 py-2 whitespace-pre-wrap ${m.role === "user" ? "ml-auto bg-gold text-gold-ink" : m.error ? "bg-danger/10 text-danger" : "bg-surface-2"}`}>{m.text}</div>
        ))}
        {busy && <p className="text-muted">{t.loading}</p>}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input className={`${inputCls} flex-1`} value={text} maxLength={1500} placeholder={t.chat.placeholder} onChange={(e) => setText(e.target.value)} />
        <button className={`${inputCls} flex items-center gap-1 bg-gold text-gold-ink`} disabled={busy} type="submit"><Send size={14} />{t.chat.send}</button>
      </form>
    </div>
  );
}
