export type Severity = "critical" | "high" | "watch" | "clear";

export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "Not available";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export const inrFull = (n: number | null | undefined) =>
  n === null || n === undefined ? "Not available" : `₹${Math.round(n).toLocaleString("en-IN")}`;

export const tone: Record<Severity, string> = {
  critical: "bg-danger/15 text-danger",
  high: "bg-warn/15 text-warn",
  watch: "bg-gold/15 text-gold",
  clear: "bg-ok/15 text-ok",
};

export function shortType(s: string, max = 70): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
