import { createServerFn } from "@tanstack/react-start";

type AskInput = {
  message: string;
  lang: "en" | "hi" | "hing";
  workCode?: string;
};

// Small in-memory limiter so a public deployment can't burn the Groq quota.
const hits: number[] = [];
function rateLimited(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0] > 60_000) hits.shift();
  if (hits.length >= 20) return true;
  hits.push(now);
  return false;
}

function clean(input: unknown): AskInput {
  const i = (input ?? {}) as Partial<AskInput>;
  const message = String(i.message ?? "").trim().slice(0, 1500);
  if (!message) throw new Error("Type a question first.");

  const lang = i.lang === "hi" || i.lang === "hing" ? i.lang : "en";
  return {
    message,
    lang,
    workCode: typeof i.workCode === "string" && i.workCode.trim() ? i.workCode.trim().slice(0, 120) : undefined,
  };
}

async function askGroq(key: string, system: string, user: string) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 650,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let reason = detail;
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string; code?: string } };
      reason = [parsed.error?.code, parsed.error?.message].filter(Boolean).join(": ") || detail;
    } catch {
      // Keep the provider's raw error when it is not JSON.
    }
    throw new Error(`Groq ${res.status}${reason ? `: ${reason.slice(0, 240)}` : ""}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const answer = body.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("Groq returned an empty answer. Please try again.");
  return answer;
}

export const askDesk = createServerFn({ method: "POST" })
  .validator(clean)
  .handler(async ({ data }) => {
    const langLine =
      data.lang === "hi"
        ? "Reply in simple Hindi using Devanagari script."
        : data.lang === "hing"
          ? "Reply in natural Hinglish, Hindi written in Roman script mixed with simple English."
          : "Reply in clear, simple English.";

    const system = `You are the MPLAD Sentinel review assistant. ${langLine}
Answer general questions about the Members of Parliament Local Area Development Scheme (MPLADS) and questions about the supplied dataset and selected work. For claims about the data, use only the supplied context and do not invent facts, amounts, dates, vendors, documents or official status. The context is an unverified public dashboard export. Clearly distinguish a screening indicator from proof of fraud or wrongdoing; never accuse a person. If data is missing, say what evidence should be checked, such as sanction, estimate, work order, measurement book, bills, geo-tagged photos, completion certificate and inspection records. Keep the answer practical and normally under 180 words.`;

    if (rateLimited()) return { ok: false as const, error: "Too many questions in the last minute. Please wait a bit and try again." };
    let context = "Dataset context unavailable.";
    try {
      const [{ getSql }, { ensureSeeded }, { buildAiContext }, session] = await Promise.all([
        import("./db"), import("./dataset/seed.server"), import("./dataset/queries.server"), import("./session.server"),
      ]);
      const sql = await getSql();
      await ensureSeeded(sql);
      await session.assertCanRead(sql);
      context = await buildAiContext(sql, data.workCode);
    } catch (err) {
      if (err instanceof Error && err.message === "Sign in required.") return { ok: false as const, error: "Sign in to use the AI desk." };
      console.error("[ask] could not build context", err);
    }
    const user = `Context (from the database):
${context}

Question: ${data.message}`;
    const key = process.env.GROQ_API_KEY?.trim();
    if (!key) {
      return {
        ok: false as const,
        error: "Groq API key is missing. Add GROQ_API_KEY to the project-root .env file and restart the dev server.",
      };
    }

    try {
      const text = await askGroq(key, system, user);
      return { ok: true as const, text, via: "Groq" };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Groq request failed. Please try again.",
      };
    }
  });
