import { MONTHS } from "./constants";

export const currency = (n: number | undefined | null) =>
  n === undefined || n === null || Number.isNaN(n)
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

export const percent = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function arrivalLabel(b: { arrival_date_day_of_month?: number; arrival_date_month?: string; arrival_date_year?: number }) {
  if (!b.arrival_date_month || !b.arrival_date_day_of_month) return "—";
  return `${b.arrival_date_day_of_month} ${b.arrival_date_month.slice(0, 3)} ${b.arrival_date_year ?? ""}`.trim();
}

/** ISO-8601 week number, which is what the training data's arrival_date_week_number uses. */
export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Parse "YYYY-MM-DD" from a date input as a local date. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function arrivalParts(d: Date) {
  return {
    arrival_date_year: d.getFullYear(),
    arrival_date_month: MONTHS[d.getMonth()],
    arrival_date_week_number: isoWeek(d),
    arrival_date_day_of_month: d.getDate(),
  };
}

export type RiskTier = "low" | "medium" | "high";

export function riskTier(p: number): RiskTier {
  if (p >= 0.5) return "high";
  if (p >= 0.3) return "medium";
  return "low";
}

export const RISK_META: Record<RiskTier, { label: string; text: string; bg: string; ring: string; hex: string }> = {
  low: { label: "Low risk", text: "text-brand-700", bg: "bg-brand-50", ring: "ring-brand-300", hex: "#1f7a4d" },
  medium: { label: "Moderate risk", text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-300", hex: "#e09a00" },
  high: { label: "High risk", text: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-300", hex: "#e5484d" },
};
