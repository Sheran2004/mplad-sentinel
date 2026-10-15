import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { AdminTab } from "@/components/AdminTab";
import { LoginForm } from "@/components/LoginForm";
import { getSession, signOut } from "@/lib/auth-api";
import { CasesTab } from "@/components/CasesTab";
import { ChatPanel } from "@/components/ChatPanel";
import { MembersTab } from "@/components/MembersTab";
import { MethodTab } from "@/components/MethodTab";
import { OverviewTab } from "@/components/OverviewTab";
import { WorkDrawer } from "@/components/WorkDrawer";
import { WorksTab } from "@/components/WorksTab";
import { DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { COPY, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/")({ component: App });

type Tab = "overview" | "works" | "members" | "cases" | "method" | "admin";
type Session = Awaited<ReturnType<typeof getSession>>;

function App() {
  const [lang, setLang] = useState<Lang>("hing");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [tab, setTab] = useState<Tab>("overview");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [openWork, setOpenWork] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWork, setChatWork] = useState<string | undefined>();
  const [casesKey, setCasesKey] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const t = COPY[lang];
  const refreshSession = () => getSession().then(setSession, () => setSession(null));
  useEffect(() => { void refreshSession(); }, []);
  const TABS: Tab[] = session?.user?.role === "admin" ? ["overview", "works", "members", "cases", "method", "admin"] : ["overview", "works", "members", "cases", "method"];
  const locked = Boolean(session?.requireLogin && !session.user);

  useEffect(() => {
    try {
      const l = localStorage.getItem("mplad-lang");
      if (l === "en" || l === "hi" || l === "hing") setLang(l);
      const th = localStorage.getItem("mplad-theme") === "light" ? "light" : "dark";
      setTheme(th);
      document.documentElement.dataset.theme = th;
    } catch { /* storage unavailable */ }
  }, []);

  const goWorks = (patch: Partial<Filters>) => { setFilters({ ...DEFAULT_FILTERS, severity: "", ...patch }); setTab("works"); };
  const closeDrawer = () => { setOpenWork(null); setCasesKey((n) => n + 1); };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <h1 className="font-display text-2xl font-semibold"><span className="status-dot mr-2" />{t.name}</h1>
          <p className="text-sm text-muted">{t.tag}</p>
        </div>
        <div className="flex items-center gap-2">
          {(["hing", "en", "hi"] as Lang[]).map((l) => (
            <button key={l} className={`h-9 rounded-lg border px-3 text-sm ${lang === l ? "border-gold text-gold" : "border-line"}`}
              onClick={() => { setLang(l); try { localStorage.setItem("mplad-lang", l); } catch { /* ignore */ } }}>
              {l === "hing" ? "Hinglish" : l === "en" ? "English" : "हिंदी"}
            </button>
          ))}
          {session?.user ? (
            <button className="h-9 rounded-lg border border-line px-3 text-sm" title={session.user.email}
              onClick={async () => { await signOut(); setTab("overview"); await refreshSession(); }}>{t.auth.signOut} ({session.user.role})</button>
          ) : session?.accountsConfigured ? (
            <button className="h-9 rounded-lg border border-gold px-3 text-sm text-gold" onClick={() => setShowLogin(true)}>{t.auth.signIn}</button>
          ) : null}
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-line" aria-label="Toggle theme" onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            setTheme(next); document.documentElement.dataset.theme = next;
            try { localStorage.setItem("mplad-theme", next); } catch { /* ignore */ }
          }}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
        </div>
      </header>

      {session && !session.accountsConfigured && (
        <p className="mb-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">{t.auth.openMode}</p>
      )}
      {locked ? <LoginForm t={t} onDone={() => void refreshSession()} /> : showLogin && !session?.user ? (
        <div className="mb-6"><LoginForm t={t} onDone={() => { setShowLogin(false); void refreshSession(); }} /></div>
      ) : null}
      {!locked && (<>
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
        {TABS.map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm whitespace-nowrap ${tab === k ? "border-b-2 border-gold font-semibold text-gold" : "text-muted"}`}>{t.tabs[k]}</button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab t={t} onOpenState={(state) => goWorks({ state })} onOpenSeverity={(severity) => goWorks({ severity })} />}
      {tab === "works" && <WorksTab t={t} filters={filters} setFilters={setFilters} onOpen={setOpenWork} />}
      {tab === "members" && <MembersTab t={t} onViewWorks={(mpKey) => goWorks({ mpKey })} />}
      {tab === "cases" && <CasesTab t={t} onOpen={setOpenWork} refreshKey={casesKey} />}
      {tab === "method" && <MethodTab t={t} />}
      {tab === "admin" && session?.user?.role === "admin" && <AdminTab t={t} />}

      {openWork && <WorkDrawer code={openWork} t={t} canWrite={session?.canWrite ?? false} signedIn={Boolean(session?.user)} onNeedLogin={() => { closeDrawer(); setShowLogin(true); }} onClose={closeDrawer} onAsk={(c) => { setChatWork(c); setChatOpen(true); }} />}
      <ChatPanel t={t} lang={lang} open={chatOpen} setOpen={setChatOpen} workCode={chatWork} setWorkCode={setChatWork} />
      </>)}
    </div>
  );
}
