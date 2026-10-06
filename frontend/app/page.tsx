"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { IconAlert, IconArrowRight, IconPlus, IconSparkles } from "@/components/Icons";
import { Swirl } from "@/components/Sidebar";
import { ArrowBadge, Button, Card, EmptyState, PageHeader, Skeleton, buttonClass, cx } from "@/components/ui";
import { ApiError, api } from "@/services/api";
import type { Booking } from "@/services/types";
import { MODEL_INFO } from "@/utils/constants";
import { RISK_META, arrivalLabel, formatDateTime, percent, riskTier } from "@/utils/format";
import { usePredictions, type StoredPrediction } from "@/utils/predictionStore";

interface Stats {
  total: number;
  confirmed: number;
  canceled: number;
  city: number;
  resort: number;
  recent: Booking[];
}

async function fetchStats(): Promise<Stats> {
  const count = (f: Parameters<typeof api.listBookings>[0]) => api.listBookings({ ...f, limit: 1 }).then((r) => r.total);
  const [recent, confirmed, canceled, city, resort] = await Promise.all([
    api.listBookings({ limit: 5 }),
    count({ status: "Confirmed" }),
    count({ status: "Canceled" }),
    count({ hotel: "City Hotel" }),
    count({ hotel: "Resort Hotel" }),
  ]);
  return { total: recent.total, confirmed, canceled, city, resort, recent: recent.bookings };
}

/** Pastel avatar tints, cycled by list position. */
const AVATAR_TINTS = ["bg-brand-100 text-brand-800", "bg-amber-100 text-amber-800", "bg-sky-100 text-sky-800", "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stored = usePredictions();
  const predictions = useMemo(() => Object.values(stored).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [stored]);

  const load = useCallback(() => {
    fetchStats()
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load statistics."));
  }, []);

  useEffect(load, [load]);

  const share = (n: number) => (stats && stats.total > 0 ? n / stats.total : 0);
  const other = stats ? Math.max(0, stats.total - stats.confirmed - stats.canceled) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Track reservations, spot likely cancellations and act before they happen."
        action={
          <>
            <Link href="/predict" className={buttonClass("primary", "lg")}>
              <IconPlus size={18} strokeWidth={2.2} /> New prediction
            </Link>
            <Link href="/bookings" className={buttonClass("secondary", "lg")}>
              View bookings
            </Link>
          </>
        }
      />

      {error && (
        <Card className="mb-6">
          <EmptyState
            icon={<IconAlert />}
            title="Booking data is unavailable"
            description={error}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        </Card>
      )}

      {/* KPIs */}
      {!error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            hero
            href="/bookings"
            label="Total bookings"
            value={stats?.total}
            chip={stats ? stats.city.toLocaleString() : undefined}
            note="City Hotel bookings"
          />
          <Kpi
            href="/bookings?status=Confirmed"
            label="Confirmed"
            value={stats?.confirmed}
            chip={stats ? percent(share(stats.confirmed)) : undefined}
            note="of all bookings"
          />
          <Kpi
            href="/bookings?status=Canceled"
            label="Canceled"
            value={stats?.canceled}
            chip={stats ? percent(share(stats.canceled)) : undefined}
            note="of all bookings"
          />
          <Kpi
            label="Cancellation rate"
            value={stats ? percent(share(stats.canceled), 1) : undefined}
            note="Canceled ÷ all bookings on record"
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <ModelPerformance className="xl:col-span-6" />
        <LatestPrediction prediction={predictions[0]} className="xl:col-span-3" />
        {!error && <LatestBookings stats={stats} className="xl:col-span-3" />}

        <RecentPredictions predictions={predictions} className={error ? "xl:col-span-12" : "xl:col-span-5"} />
        {!error && (
          <>
            <StatusProgress
              className="xl:col-span-4"
              loading={!stats}
              total={stats?.total ?? 0}
              parts={[
                { label: "Confirmed", value: stats?.confirmed ?? 0, kind: "solid" },
                { label: "Canceled", value: stats?.canceled ?? 0, kind: "dark" },
                { label: "Other", value: other, kind: "hatch" },
              ]}
            />
            <HotelSplit className="xl:col-span-3" city={stats?.city} resort={stats?.resort} />
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Kpi({
  label,
  value,
  chip,
  note,
  href,
  hero,
}: {
  label: string;
  value: number | string | undefined;
  chip?: string;
  note: string;
  href?: string;
  hero?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cx("text-lg font-medium", hero ? "text-white" : "text-slate-900")}>{label}</p>
        {href && <ArrowBadge inverted={hero} />}
      </div>
      {value === undefined ? (
        <Skeleton className={cx("mt-4 h-12 w-24", hero && "bg-white/20")} />
      ) : (
        <p className={cx("mt-3 text-[52px] font-semibold leading-none tracking-tight tabular-nums", hero ? "text-white" : "text-slate-900")}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      )}
      <p className={cx("mt-5 flex items-center gap-2 text-[13px]", hero ? "text-brand-200" : "text-brand-700")}>
        {chip !== undefined && (
          <span
            className={cx(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-semibold tabular-nums ring-1",
              hero ? "ring-brand-300/70" : "ring-brand-600/50",
            )}
          >
            {chip}
          </span>
        )}
        {note}
      </p>
    </>
  );

  const cls = cx(
    "group relative block overflow-hidden rounded-3xl p-6 animate-fade-up transition",
    hero ? "bg-gradient-to-br from-brand-700 via-brand-800 to-ink-950 text-white shadow-[0_18px_40px_-20px_rgba(19,78,50,0.7)]" : "bg-white",
    href && !hero && "hover:shadow-[0_10px_30px_-18px_rgba(16,24,20,0.35)]",
  );

  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Pill-shaped bars on a hatched track: each metric fills its share of a 0–1 scale. */
function ModelPerformance({ className }: { className?: string }) {
  const best = Math.max(...MODEL_INFO.metrics.map((m) => m.value));
  const fills = ["bg-brand-700", "bg-brand-500", "bg-brand-300", "bg-ink-900", "bg-brand-600"];
  return (
    <Card className={cx("animate-fade-up p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Model performance</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {MODEL_INFO.name} on the held-out test set · threshold {MODEL_INFO.threshold.toFixed(2)}
          </p>
        </div>
      </div>
      <ul className="mt-6 flex items-end justify-between gap-3 sm:gap-5" aria-label="Model metrics">
        {MODEL_INFO.metrics.map((m, i) => {
          const top = m.value === best;
          return (
            <li key={m.label} className="group flex flex-1 flex-col items-center">
              <div className="relative flex h-44 w-full max-w-[64px] items-end overflow-visible">
                <div className="hatch absolute inset-0 rounded-full" />
                <div
                  className={cx("relative w-full rounded-full transition-all duration-700", fills[i % fills.length])}
                  style={{ height: `${m.value * 100}%` }}
                >
                  <span
                    className={cx(
                      "absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700 shadow-sm ring-1 ring-line transition",
                      top ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    {m.value.toFixed(3)}
                  </span>
                  {top && <span className="absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-white ring-2 ring-ink-900" />}
                </div>
              </div>
              <span className="mt-3 text-center text-[13px] text-slate-500">{m.label}</span>
              <span className="sr-only">{m.value.toFixed(3)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function LatestPrediction({ prediction, className }: { prediction?: StoredPrediction; className?: string }) {
  const tier = prediction ? riskTier(prediction.probability) : null;
  return (
    <Card className={cx("flex animate-fade-up flex-col p-6", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Latest prediction</h2>
      {prediction && tier ? (
        <>
          <p className="mt-5 break-words text-[26px] font-semibold leading-tight tracking-tight text-brand-800">
            {Math.round(prediction.probability * 100)}% risk
          </p>
          <p className="mt-1 truncate text-[15px] font-medium text-slate-700" title={prediction.email}>
            {prediction.email}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {prediction.hotel} · {formatDateTime(prediction.createdAt)}
          </p>
          <span className={cx("mt-3 inline-flex w-fit rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", RISK_META[tier].bg, RISK_META[tier].text, RISK_META[tier].ring)}>
            {RISK_META[tier].label}
          </span>
          <Link
            href={`/bookings?id=${prediction.bookingId}`}
            className="mt-auto flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-brand-700 to-ink-900 text-[15px] font-medium text-white transition hover:from-brand-800 hover:to-ink-950 max-xl:mt-6"
          >
            Open booking <IconArrowRight size={17} />
          </Link>
        </>
      ) : (
        <>
          <p className="mt-5 text-[26px] font-semibold leading-tight tracking-tight text-brand-800">Nothing scored yet</p>
          <p className="mt-2 text-sm text-slate-500">Predictions made in this browser show up here.</p>
          <Link
            href="/predict"
            className="mt-auto flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-brand-700 to-ink-900 text-[15px] font-medium text-white transition hover:from-brand-800 hover:to-ink-950 max-xl:mt-6"
          >
            <IconSparkles size={17} /> Start prediction
          </Link>
        </>
      )}
    </Card>
  );
}

function LatestBookings({ stats, className }: { stats: Stats | null; className?: string }) {
  return (
    <Card className={cx("animate-fade-up p-6 xl:row-span-1", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Latest bookings</h2>
        <Link href="/bookings" className={buttonClass("secondary", "sm")}>
          View all
        </Link>
      </div>
      {!stats ? (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : stats.recent.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No bookings yet.{" "}
          <Link href="/predict" className="font-medium text-brand-700 hover:underline">
            Create the first one
          </Link>
        </p>
      ) : (
        <ul className="mt-4 space-y-1">
          {stats.recent.map((b, i) => (
            <li key={b.id}>
              <Link href={`/bookings?id=${b.id}`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-panel">
                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold uppercase", AVATAR_TINTS[i % AVATAR_TINTS.length])}>
                  {b.email.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-slate-900">{b.email}</span>
                  <span className="block text-xs text-slate-400">
                    Arrival: {arrivalLabel(b)} · {b.hotel.replace(" Hotel", "")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentPredictions({ predictions, className }: { predictions: StoredPrediction[]; className?: string }) {
  return (
    <Card className={cx("animate-fade-up p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent predictions</h2>
          {predictions.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              {predictions.length} scored in this browser · average risk{" "}
              {percent(predictions.reduce((s, p) => s + p.probability, 0) / predictions.length)}
            </p>
          )}
        </div>
        <Link href="/predict" className={buttonClass("secondary", "sm")}>
          <IconPlus size={14} strokeWidth={2.2} /> New
        </Link>
      </div>

      {predictions.length === 0 ? (
        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-panel p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand-700">
            <IconSparkles size={18} />
          </span>
          <p className="text-sm text-slate-500">Score a booking and its risk will be listed here for quick follow-up.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-1">
          {predictions.slice(0, 4).map((p) => {
            const t = riskTier(p.probability);
            return (
              <li key={p.bookingId}>
                <Link href={`/bookings?id=${p.bookingId}`} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-panel">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums text-white"
                    style={{ background: RISK_META[t].hex }}
                  >
                    {Math.round(p.probability * 100)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-slate-900">{p.email}</span>
                    <span className="block truncate text-xs text-slate-400">
                      Scored for <span className="font-medium text-slate-700">{p.hotel}</span> · {formatDateTime(p.createdAt)}
                    </span>
                  </span>
                  <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", RISK_META[t].bg, RISK_META[t].text, RISK_META[t].ring)}>
                    {RISK_META[t].label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

type Part = { label: string; value: number; kind: "solid" | "dark" | "hatch" };

/** Semicircular stacked meter of booking statuses; the centre shows the cancellation share. */
function StatusProgress({ parts, total, loading, className }: { parts: Part[]; total: number; loading: boolean; className?: string }) {
  const patternId = `hatch${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const canceled = parts.find((p) => p.label === "Canceled")?.value ?? 0;
  const W = 260;
  const stroke = 40;
  const r = (W - stroke) / 2;
  const cy = W / 2;
  const arc = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${W - stroke / 2} ${cy}`;

  let start = 0;
  const segments = parts
    .map((p) => {
      const len = total > 0 ? (p.value / total) * 100 : 0;
      const seg = { ...p, start, len };
      start += len;
      return seg;
    })
    .filter((s) => s.len > 0);

  const colour = (k: Part["kind"]) => (k === "solid" ? "#1f7a4d" : k === "dark" ? "#0f3322" : `url(#${patternId})`);

  return (
    <Card className={cx("animate-fade-up p-6", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Booking status</h2>
      <div className="relative mx-auto mt-4 w-full max-w-[260px]">
        <svg viewBox={`0 0 ${W} ${cy + stroke / 2}`} className="w-full" role="img" aria-label={`Cancellation rate ${total ? percent(canceled / total) : "0%"}`}>
          <defs>
            <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="#fff" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="#7d8b84" strokeWidth="2.4" />
            </pattern>
          </defs>
          <path d={arc} fill="none" stroke="#eef1ef" strokeWidth={stroke} strokeLinecap="round" />
          {!loading &&
            [...segments].reverse().map((s) => (
              <path
                key={s.label}
                d={arc}
                pathLength={100}
                fill="none"
                stroke={colour(s.kind)}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${s.len} 100`}
                strokeDashoffset={-s.start}
              />
            ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          {loading ? (
            <Skeleton className="mx-auto h-11 w-24" />
          ) : (
            <p className="text-[44px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
              {total ? percent(canceled / total) : "0%"}
            </p>
          )}
          <p className="mt-1 text-[13px] text-slate-500">Bookings canceled</p>
        </div>
      </div>
      <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[13px] text-slate-500">
            <span
              className={cx(
                "h-3.5 w-3.5 rounded-full",
                p.kind === "solid" ? "bg-brand-600" : p.kind === "dark" ? "bg-ink-900" : "hatch ring-1 ring-slate-300",
              )}
            />
            {p.label}
            <span className="font-medium tabular-nums text-slate-800">{loading ? "—" : p.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HotelSplit({ city, resort, className }: { city?: number; resort?: number; className?: string }) {
  const loading = city === undefined || resort === undefined;
  const total = (city ?? 0) + (resort ?? 0);
  const cityShare = total > 0 ? (city ?? 0) / total : 0;
  return (
    <div className={cx("relative flex animate-fade-up flex-col overflow-hidden rounded-3xl bg-ink-950 p-6 text-white", className)}>
      <Swirl />
      <div className="relative flex h-full flex-col">
        <h2 className="text-lg font-medium">Hotel split</h2>
        {loading ? (
          <Skeleton className="mt-6 h-14 w-32 bg-white/15" />
        ) : (
          <p className="mt-5 text-[52px] font-semibold leading-none tracking-tight tabular-nums">{percent(cityShare)}</p>
        )}
        <p className="mt-2 text-sm text-white/60">of bookings are at the City Hotel</p>
        <div className="mt-6 flex h-3 gap-1 overflow-hidden rounded-full bg-white/10">
          {!loading && total > 0 && (
            <>
              <div className="rounded-full bg-white" style={{ width: `${cityShare * 100}%` }} />
              <div className="flex-1 rounded-full bg-brand-400" />
            </>
          )}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
          <SplitLink href="/bookings?hotel=City%20Hotel" label="City" value={city} dot="bg-white" />
          <SplitLink href="/bookings?hotel=Resort%20Hotel" label="Resort" value={resort} dot="bg-brand-400" />
        </div>
      </div>
    </div>
  );
}

function SplitLink({ href, label, value, dot }: { href: string; label: string; value?: number; dot: string }) {
  return (
    <Link href={href} className="rounded-2xl bg-white/[0.07] px-3.5 py-3 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
      <span className="flex items-center gap-2 text-xs text-white/60">
        <span className={cx("h-2 w-2 rounded-full", dot)} />
        {label}
      </span>
      <span className="mt-1 block text-xl font-semibold tabular-nums">{value === undefined ? "—" : value.toLocaleString()}</span>
    </Link>
  );
}

