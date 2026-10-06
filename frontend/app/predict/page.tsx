"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DatePicker } from "@/components/DatePicker";
import { RiskGauge } from "@/components/RiskGauge";
import { useToast } from "@/components/Toast";
import {
  IconArrowRight,
  IconBan,
  IconBuilding,
  IconCalendar,
  IconCard,
  IconCheck,
  IconCopy,
  IconInfo,
  IconSparkles,
  IconUser,
  IconUsers,
} from "@/components/Icons";
import { Swirl } from "@/components/Sidebar";
import { Autocomplete, Select } from "@/components/Select";
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Stepper, buttonClass, cx } from "@/components/ui";
import { ApiError, api } from "@/services/api";
import type { Hotel, PredictionRequest, PredictionResponse } from "@/services/types";
import {
  COUNTRIES,
  CUSTOMER_TYPES,
  DEPOSIT_TYPES,
  DISTRIBUTION_CHANNELS,
  MARKET_SEGMENTS,
  MEALS,
  ROOM_TYPES,
} from "@/utils/constants";
import {
  RISK_META,
  arrivalParts,
  currency,
  daysUntil,
  parseDateInput,
  percent,
  riskTier,
  toDateInput,
} from "@/utils/format";
import { savePrediction } from "@/utils/predictionStore";

interface FormState {
  email: string;
  country: string;
  customer_type: string;
  hotel: Hotel;
  arrival: string;
  /** Derived from the arrival date; not editable. */
  lead_time: string;
  stays_in_weekend_nights: number;
  stays_in_week_nights: number;
  adults: number;
  children: number;
  babies: number;
  meal: string;
  reserved_room_type: string;
  adr: string;
  deposit_type: string;
  market_segment: string;
  distribution_channel: string;
  agent: string;
  required_car_parking_spaces: number;
  total_of_special_requests: number;
}

function initialState(): FormState {
  const arrival = new Date();
  arrival.setDate(arrival.getDate() + 45);
  return {
    email: "",
    country: "PRT",
    customer_type: "Transient",
    hotel: "City Hotel",
    arrival: toDateInput(arrival),
    lead_time: "45",
    stays_in_weekend_nights: 1,
    stays_in_week_nights: 2,
    adults: 2,
    children: 0,
    babies: 0,
    meal: "BB",
    reserved_room_type: "A",
    adr: "120",
    deposit_type: "No Deposit",
    market_segment: "Online TA",
    distribution_channel: "TA/TO",
    agent: "9",
    required_car_parking_spaces: 0,
    total_of_special_requests: 0,
  };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Maps backend field names to the form control that owns them. */
const FIELD_ALIAS: Record<string, string> = {
  arrival_date_year: "arrival",
  arrival_date_month: "arrival",
  arrival_date_week_number: "arrival",
  arrival_date_day_of_month: "arrival",
};

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (!/^[A-Za-z]{2,3}$/.test(f.country.trim())) e.country = "Use a 2–3 letter country code, e.g. PRT.";
  const arrival = parseDateInput(f.arrival);
  if (!arrival) e.arrival = "Choose an arrival date.";
  else if (daysUntil(arrival) < 0) e.arrival = "Arrival can't be in the past.";
  const adr = Number(f.adr);
  if (f.adr === "" || !Number.isFinite(adr) || adr < 0) e.adr = "Enter a nightly rate of 0 or more.";
  if (f.stays_in_weekend_nights + f.stays_in_week_nights === 0) e.nights = "A stay needs at least one night.";
  if (f.adults + f.children + f.babies === 0) e.guests = "Add at least one guest.";
  if (!f.agent.trim()) e.agent = "Enter an agent ID or choose “No agent”.";
  return e;
}

function toPayload(f: FormState): PredictionRequest {
  const arrival = parseDateInput(f.arrival)!;
  return {
    email: f.email.trim(),
    hotel: f.hotel,
    lead_time: Math.max(0, daysUntil(arrival)),
    ...arrivalParts(arrival),
    stays_in_weekend_nights: f.stays_in_weekend_nights,
    stays_in_week_nights: f.stays_in_week_nights,
    adults: f.adults,
    children: f.children,
    babies: f.babies,
    meal: f.meal,
    country: f.country.trim().toUpperCase(),
    market_segment: f.market_segment,
    distribution_channel: f.distribution_channel,
    reserved_room_type: f.reserved_room_type,
    deposit_type: f.deposit_type,
    customer_type: f.customer_type,
    adr: Number(f.adr),
    required_car_parking_spaces: f.required_car_parking_spaces,
    total_of_special_requests: f.total_of_special_requests,
    agent: f.agent.trim(),
  };
}

export default function PredictPage() {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ res: PredictionResponse; payload: PredictionRequest } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearErrors(key as string);
  };

  const clearErrors = (...keys: string[]) =>
    setErrors((e) => (keys.some((k) => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) : e));

  const onArrivalChange = (value: string) => {
    setForm((f) => {
      const d = parseDateInput(value);
      const next = { ...f, arrival: value };
      next.lead_time = d ? String(Math.max(0, daysUntil(d))) : "";
      return next;
    });
    clearErrors("arrival");
  };

  const derived = useMemo(() => {
    const nights = form.stays_in_weekend_nights + form.stays_in_week_nights;
    const guests = form.adults + form.children + form.babies;
    const arrival = parseDateInput(form.arrival);
    const checkout = arrival ? new Date(arrival.getTime() + nights * 86400000) : null;
    const adr = Number(form.adr) || 0;
    return {
      nights,
      guests,
      family: form.children + form.babies > 0,
      arrival,
      checkout,
      revenue: adr * nights,
    };
  }, [form]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`field-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const payload = toPayload(form);
    setSubmitting(true);
    try {
      const res = await api.predict(payload);
      setResult({ res, payload });
      if (res.booking_id) {
        savePrediction({
          bookingId: res.booking_id,
          email: payload.email,
          hotel: payload.hotel,
          probability: res.cancellation_probability,
          prediction: res.prediction,
          createdAt: new Date().toISOString(),
        });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      const msg = apiErr?.message || "Prediction failed.";
      if (apiErr?.fields.length) {
        const fieldErrs: Record<string, string> = {};
        apiErr.fields.forEach((f) => (fieldErrs[FIELD_ALIAS[f] ?? f] = `Rejected by the server (${f}).`));
        setErrors(fieldErrs);
      }
      setServerError(msg);
      toast("error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setForm(initialState());
    setErrors({});
    setServerError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    return <ResultView res={result.res} payload={result.payload} onNew={reset} onEdit={() => setResult(null)} />;
  }

  return (
    <>
      <PageHeader
        title="New prediction"
        description="Enter the reservation details. The model scores the cancellation risk and the booking is saved to your records."
      />

      <form onSubmit={onSubmit} noValidate className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Section icon={<IconUser size={17} />} title="Guest" subtitle="Prior stays and cancellations are looked up by email.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email" htmlFor="field-email" error={errors.email} className="sm:col-span-2">
                <Input
                  id="field-email"
                  type="email"
                  autoComplete="off"
                  placeholder="guest@example.com"
                  value={form.email}
                  invalid={!!errors.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Country" htmlFor="field-country" error={errors.country} hint="ISO 3166 code">
                <Autocomplete
                  id="field-country"
                  value={form.country}
                  maxLength={3}
                  invalid={!!errors.country}
                  options={COUNTRIES}
                  transform={(v) => v.toUpperCase()}
                  onChange={(v) => set("country", v)}
                />
              </Field>
              <Field label="Customer type" htmlFor="field-customer_type">
                <Select id="field-customer_type" value={form.customer_type} onChange={(e) => set("customer_type", e.target.value)}>
                  {CUSTOMER_TYPES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Section>

          <Section icon={<IconCalendar size={17} />} title="Stay" subtitle="Property, dates and party size.">
            <div className="space-y-5">
              <Field label="Hotel">
                <Segmented
                  name="Hotel"
                  value={form.hotel}
                  onChange={(v) => set("hotel", v)}
                  options={[
                    { value: "City Hotel", label: "City Hotel" },
                    { value: "Resort Hotel", label: "Resort Hotel" },
                  ]}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Arrival date" htmlFor="field-arrival" error={errors.arrival}>
                  <DatePicker
                    id="field-arrival"
                    value={form.arrival}
                    min={toDateInput(new Date())}
                    nights={derived.nights}
                    invalid={!!errors.arrival}
                    onChange={onArrivalChange}
                  />
                </Field>
                <Field label="Lead time (days)" htmlFor="field-lead_time" hint="Days from today to the arrival date">
                  <div className="relative">
                    <Input
                      id="field-lead_time"
                      readOnly
                      tabIndex={-1}
                      aria-readonly
                      value={form.lead_time === "" ? "—" : form.lead_time}
                      className="cursor-default bg-panel! pr-24 font-semibold tabular-nums text-slate-700 focus:ring-0! hover:border-line!"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-line">
                      Auto
                    </span>
                  </div>
                </Field>
              </div>

              <div id="field-nights" className="grid gap-5 sm:grid-cols-2">
                <Field label="Weekend nights" error={errors.nights}>
                  <Stepper label="Weekend nights" value={form.stays_in_weekend_nights} max={30} invalid={!!errors.nights} onChange={(n) => { set("stays_in_weekend_nights", n); clearErrors("nights"); }} />
                </Field>
                <Field label="Week nights">
                  <Stepper label="Week nights" value={form.stays_in_week_nights} max={60} invalid={!!errors.nights} onChange={(n) => { set("stays_in_week_nights", n); clearErrors("nights"); }} />
                </Field>
              </div>

              <div id="field-guests" className="grid gap-5 sm:grid-cols-3">
                <Field label="Adults" error={errors.guests}>
                  <Stepper label="Adults" value={form.adults} max={10} invalid={!!errors.guests} onChange={(n) => { set("adults", n); clearErrors("guests"); }} />
                </Field>
                <Field label="Children">
                  <Stepper label="Children" value={form.children} max={10} onChange={(n) => { set("children", n); clearErrors("guests"); }} />
                </Field>
                <Field label="Babies">
                  <Stepper label="Babies" value={form.babies} max={10} onChange={(n) => { set("babies", n); clearErrors("guests"); }} />
                </Field>
              </div>
            </div>
          </Section>

          <Section icon={<IconBuilding size={17} />} title="Room & services" subtitle="What was reserved and any extras.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Room type" htmlFor="field-reserved_room_type">
                <Select id="field-reserved_room_type" value={form.reserved_room_type} onChange={(e) => set("reserved_room_type", e.target.value)}>
                  {ROOM_TYPES.map((r) => (
                    <option key={r} value={r}>
                      Room type {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Meal plan" htmlFor="field-meal">
                <Select id="field-meal" value={form.meal} onChange={(e) => set("meal", e.target.value)}>
                  {MEALS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} ({m.value})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Car parking spaces">
                <Stepper label="Car parking spaces" value={form.required_car_parking_spaces} max={8} onChange={(n) => set("required_car_parking_spaces", n)} />
              </Field>
              <Field label="Special requests">
                <Stepper label="Special requests" value={form.total_of_special_requests} max={5} onChange={(n) => set("total_of_special_requests", n)} />
              </Field>
            </div>
          </Section>

          <Section icon={<IconCard size={17} />} title="Rate & channel" subtitle="Pricing, deposit and how the booking arrived.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Average daily rate (ADR)" htmlFor="field-adr" error={errors.adr}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                  <Input
                    id="field-adr"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="pl-8"
                    value={form.adr}
                    invalid={!!errors.adr}
                    onChange={(e) => set("adr", e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Deposit type" htmlFor="field-deposit_type">
                <Select id="field-deposit_type" value={form.deposit_type} onChange={(e) => set("deposit_type", e.target.value)}>
                  {DEPOSIT_TYPES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Market segment" htmlFor="field-market_segment">
                <Select id="field-market_segment" value={form.market_segment} onChange={(e) => set("market_segment", e.target.value)}>
                  {MARKET_SEGMENTS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Distribution channel" htmlFor="field-distribution_channel">
                <Select id="field-distribution_channel" value={form.distribution_channel} onChange={(e) => set("distribution_channel", e.target.value)}>
                  {DISTRIBUTION_CHANNELS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Travel agent" htmlFor="field-agent" error={errors.agent} hint="Agent ID from your channel manager" className="sm:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="field-agent"
                    placeholder="e.g. 9"
                    value={form.agent === "0" ? "" : form.agent}
                    disabled={form.agent === "0"}
                    invalid={!!errors.agent}
                    onChange={(e) => set("agent", e.target.value)}
                  />
                  <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border border-line px-4 text-sm text-slate-700 hover:bg-panel">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={form.agent === "0"}
                      onChange={(e) => set("agent", e.target.checked ? "0" : "")}
                    />
                    No agent
                  </label>
                </div>
              </Field>
            </div>
          </Section>
        </div>

        {/* Summary rail */}
        <aside className="xl:sticky xl:top-8 xl:self-start">
          <Card className="overflow-hidden">
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-ink-950 px-6 py-6 text-white">
              <Swirl />
              <p className="relative text-sm font-medium text-brand-200">Booking summary</p>
              <p className="relative mt-2 text-[28px] font-semibold leading-tight tracking-tight">{form.hotel}</p>
              <p className="relative mt-1 text-sm text-white/60">
                {derived.arrival ? derived.arrival.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—"}
                {" → "}
                {derived.checkout ? derived.checkout.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
            <dl className="divide-y divide-line px-6 text-sm">
              <SummaryRow icon={<IconMoonSmall />} label="Total stay" value={`${derived.nights} night${derived.nights === 1 ? "" : "s"}`} />
              <SummaryRow icon={<IconUsers size={15} />} label="Total guests" value={String(derived.guests)} />
              <SummaryRow icon={<IconUser size={15} />} label="Family booking" value={derived.family ? "Yes" : "No"} />
              <SummaryRow icon={<IconCalendar size={15} />} label="Lead time" value={form.lead_time ? `${form.lead_time} days` : "—"} />
              <SummaryRow icon={<IconCard size={15} />} label="Est. room revenue" value={currency(derived.revenue)} strong />
            </dl>
            <div className="border-t border-line p-6">
              {serverError && (
                <div className="mb-4 flex gap-2 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200" role="alert">
                  <IconInfo size={16} className="mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                {!submitting && <IconSparkles size={17} />}
                {submitting ? "Scoring booking…" : "Predict & save booking"}
              </Button>
              <p className="mt-3 text-center text-xs text-slate-500">Total stay, guests and family flag are derived automatically.</p>
            </div>
          </Card>
        </aside>
      </form>
    </>
  );
}

function IconMoonSmall() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  );
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="animate-fade-up">
      <CardHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="px-6 pb-6 pt-4">{children}</div>
    </Card>
  );
}

function SummaryRow({ icon, label, value, strong }: { icon: ReactNode; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="flex items-center gap-2 text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className={cx("tabular-nums", strong ? "font-semibold text-slate-900" : "font-medium text-slate-800")}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ResultView({
  res,
  payload,
  onNew,
  onEdit,
}: {
  res: PredictionResponse;
  payload: PredictionRequest;
  onNew: () => void;
  onEdit: () => void;
}) {
  const toast = useToast();
  const p = res.cancellation_probability;
  const tier = riskTier(p);
  const meta = RISK_META[tier];
  const h = res.customer_history;
  const [status, setStatus] = useState<"Confirmed" | "Canceled">("Confirmed");
  const [cancelling, setCancelling] = useState(false);

  const signals = buildSignals(payload, h);

  async function cancel() {
    if (!res.booking_id) return;
    setCancelling(true);
    try {
      await api.cancelBooking(res.booking_id);
      setStatus("Canceled");
      toast("success", "Booking marked as canceled.");
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Could not cancel the booking.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Prediction result"
        title={res.prediction === 1 ? "Likely to cancel" : "Likely to stay"}
        description={res.result}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onEdit}>
              Adjust details
            </Button>
            <Button onClick={onNew}>
              <IconSparkles size={16} /> New prediction
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <Card className="animate-fade-up overflow-hidden">
          <div className={cx("flex flex-col items-center px-6 pb-8 pt-10", meta.bg)}>
            <RiskGauge probability={p} />
            <span className={cx("mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1", meta.text, meta.ring)}>
              <span className="h-2 w-2 rounded-full" style={{ background: meta.hex }} />
              {meta.label}
            </span>
            <p className="mt-3 max-w-sm text-center text-sm text-slate-600">
              The model flags bookings at {percent(0.5)} or higher as likely cancellations.
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-4">
            <Mini label="Hotel" value={payload.hotel.replace(" Hotel", "")} />
            <Mini label="Arrival" value={`${payload.arrival_date_day_of_month} ${payload.arrival_date_month.slice(0, 3)}`} />
            <Mini label="Nights" value={String(payload.stays_in_weekend_nights + payload.stays_in_week_nights)} />
            <Mini label="ADR" value={currency(payload.adr)} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="animate-fade-up">
            <CardHeader title="Saved booking" subtitle={res.saved_to_database ? "Stored in the bookings database." : "The database was unavailable, so this booking was not saved."} />
            <div className="space-y-4 px-6 pb-6 pt-3">
              {res.booking_id ? (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-panel px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Booking ID</p>
                      <p className="truncate font-mono text-[13px] text-slate-800">{res.booking_id}</p>
                    </div>
                    <button
                      type="button"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-slate-900"
                      aria-label="Copy booking ID"
                      onClick={() => {
                        navigator.clipboard?.writeText(res.booking_id!).then(
                          () => toast("success", "Booking ID copied."),
                          () => toast("error", "Couldn't copy to clipboard."),
                        );
                      }}
                    >
                      <IconCopy size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Guest</span>
                    <span className="truncate pl-4 font-medium text-slate-800">{payload.email.toLowerCase()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Status</span>
                    <span className={cx("font-medium", status === "Canceled" ? "text-rose-600" : "text-brand-700")}>{status}</span>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <Link
                      href={`/bookings?id=${res.booking_id}`}
                      className={buttonClass("secondary", "md", "flex-1")}
                    >
                      Open in bookings <IconArrowRight size={16} />
                    </Link>
                    {status !== "Canceled" && (
                      <Button variant="ghost" className="flex-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={cancel} loading={cancelling}>
                        {!cancelling && <IconBan size={16} />} Cancel booking
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">No booking ID was returned. The prediction is still valid.</p>
              )}
            </div>
          </Card>

          <Card className="animate-fade-up">
            <CardHeader title="Guest history" subtitle="Looked up by email from earlier bookings." />
            <div className="grid grid-cols-3 divide-x divide-line">
              <Mini label="Previous" value={String(h.total_previous_bookings)} />
              <Mini label="Honoured" value={String(h.previous_bookings_not_canceled)} />
              <Mini label="Canceled" value={String(h.previous_cancellations)} tone={h.previous_cancellations > 0 ? "text-rose-600" : undefined} />
            </div>
            <p className="border-t border-line px-6 py-4 text-sm text-slate-500">
              {h.is_repeated_guest ? "Returning guest." : "First booking on record for this email."}
            </p>
          </Card>
        </div>

        <Card className="animate-fade-up lg:col-span-2">
          <CardHeader
            title="Booking signals"
            subtitle="Attributes that are commonly associated with cancellation in hotel booking data. These are general patterns, not the model's own explanation of this score."
          />
          <ul className="grid gap-3 p-6 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {signals.map((s) => (
              <li key={s.label} className="flex items-start gap-3 rounded-2xl bg-panel p-4">
                <span
                  className={cx(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                    s.direction === "up" ? "bg-rose-100 text-rose-600" : "bg-brand-100 text-brand-700",
                  )}
                >
                  {s.direction === "up" ? <IconInfo size={14} /> : <IconCheck size={14} strokeWidth={2.4} />}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.label}</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cx("mt-1 text-xl font-semibold tabular-nums text-slate-900", tone)}>{value}</p>
    </div>
  );
}

type Signal = { label: string; detail: string; direction: "up" | "down" };

function buildSignals(p: PredictionRequest, h: PredictionResponse["customer_history"]): Signal[] {
  const s: Signal[] = [];
  if (p.lead_time >= 120) s.push({ label: "Long lead time", detail: `Booked ${p.lead_time} days ahead; plans change more often over long horizons.`, direction: "up" });
  else if (p.lead_time <= 14) s.push({ label: "Short lead time", detail: `Arrival is ${p.lead_time} days away.`, direction: "down" });

  if (p.deposit_type === "Non Refund") s.push({ label: "Non-refundable deposit", detail: "In this dataset, non-refund deposits are linked to high cancellation rates.", direction: "up" });
  else if (p.deposit_type === "No Deposit") s.push({ label: "No deposit", detail: "There's no financial commitment from the guest.", direction: "up" });

  if (p.total_of_special_requests > 0) s.push({ label: "Special requests", detail: `${p.total_of_special_requests} request(s); engaged guests tend to keep bookings.`, direction: "down" });
  if (p.required_car_parking_spaces > 0) s.push({ label: "Parking requested", detail: "Guests who reserve parking rarely cancel.", direction: "down" });
  if (p.market_segment === "Groups") s.push({ label: "Group booking", detail: "Group allocations often release unused rooms.", direction: "up" });
  if (p.market_segment === "Online TA") s.push({ label: "Online travel agency", detail: "OTA bookings are often free to cancel.", direction: "up" });
  if (p.market_segment === "Direct" || p.market_segment === "Corporate") s.push({ label: `${p.market_segment} booking`, detail: "Direct and corporate channels tend to be more stable.", direction: "down" });
  if (h.previous_cancellations > 0) s.push({ label: "Previous cancellations", detail: `This guest has canceled ${h.previous_cancellations} time(s) before.`, direction: "up" });
  if (h.previous_bookings_not_canceled > 0) s.push({ label: "Reliable history", detail: `${h.previous_bookings_not_canceled} earlier booking(s) were kept.`, direction: "down" });

  if (s.length === 0) s.push({ label: "No strong signals", detail: "Nothing unusual stands out in this booking's attributes.", direction: "down" });
  return s.slice(0, 6);
}
