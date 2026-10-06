"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ApiError, api } from "@/services/api";
import type { Booking } from "@/services/types";
import { BOOKING_STATUSES } from "@/utils/constants";
import { RISK_META, arrivalLabel, currency, formatDateTime, percent, riskTier } from "@/utils/format";
import type { StoredPrediction } from "@/utils/predictionStore";
import { IconBan, IconCopy, IconX } from "./Icons";
import { useToast } from "./Toast";
import { Select } from "./Select";
import { Button, Skeleton, StatusBadge, cx } from "./ui";

export function BookingDrawer({
  bookingId,
  prediction,
  onClose,
  onUpdated,
}: {
  bookingId: string;
  prediction?: StoredPrediction;
  onClose: () => void;
  onUpdated: (b: Partial<Booking> & { id: string }) => void;
}) {
  const toast = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getBooking(bookingId)
      .then(({ booking }) => {
        if (!alive) return;
        setBooking(booking);
        setStatus(booking.booking_status);
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "Could not load booking."));
    return () => {
      alive = false;
    };
  }, [bookingId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveStatus() {
    if (!booking || status === booking.booking_status) return;
    setSaving(true);
    try {
      const res = await api.updateStatus(booking.id, status);
      const next = res.booking.booking_status ?? status;
      setBooking({ ...booking, booking_status: next });
      setStatus(next);
      onUpdated({ id: booking.id, booking_status: next });
      toast("success", res.message);
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    if (!booking) return;
    setSaving(true);
    try {
      const res = await api.cancelBooking(booking.id);
      setBooking({ ...booking, booking_status: "Canceled" });
      setStatus("Canceled");
      onUpdated({ id: booking.id, booking_status: "Canceled" });
      toast("success", res.message);
      setConfirmCancel(false);
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Cancel failed.");
    } finally {
      setSaving(false);
    }
  }

  const statusOptions = booking && !BOOKING_STATUSES.includes(booking.booking_status) ? [booking.booking_status, ...BOOKING_STATUSES] : BOOKING_STATUSES;
  const isCanceled = booking?.booking_status.toLowerCase().includes("cancel");
  const tier = prediction ? riskTier(prediction.probability) : null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg animate-slide-in flex-col bg-white shadow-2xl sm:inset-y-3 sm:right-3 sm:overflow-hidden sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-brand-600">Booking details</p>
            <h2 id="drawer-title" className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">
              {booking?.email ?? (error ? "Unavailable" : "Loading…")}
            </h2>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-slate-500 hover:text-slate-800"
              onClick={() => navigator.clipboard?.writeText(bookingId).then(() => toast("success", "Booking ID copied."))}
              title="Copy booking ID"
            >
              {bookingId}
              <IconCopy size={12} />
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 ring-1 ring-line hover:bg-panel">
            <IconX />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{error}</div>
          ) : !booking ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={booking.booking_status} />
                {prediction && tier && (
                  <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", RISK_META[tier].bg, RISK_META[tier].text, RISK_META[tier].ring)}>
                    {percent(prediction.probability)} cancellation risk
                  </span>
                )}
                <span className="text-xs text-slate-500">Created {formatDateTime(booking.created_at)}</span>
              </div>

              <DetailGroup title="Stay">
                <Detail label="Hotel" value={booking.hotel} />
                <Detail label="Arrival" value={arrivalLabel(booking)} />
                <Detail label="Week nights" value={booking.stays_in_week_nights} />
                <Detail label="Weekend nights" value={booking.stays_in_weekend_nights} />
                <Detail label="Total stay" value={booking.total_stay !== undefined ? `${booking.total_stay} nights` : undefined} />
                <Detail label="Lead time" value={booking.lead_time !== undefined ? `${booking.lead_time} days` : undefined} />
              </DetailGroup>

              <DetailGroup title="Guests">
                <Detail label="Adults" value={booking.adults} />
                <Detail label="Children" value={booking.children} />
                <Detail label="Babies" value={booking.babies} />
                <Detail label="Total guests" value={booking.total_guests} />
                <Detail label="Family" value={booking.is_family === undefined ? undefined : booking.is_family ? "Yes" : "No"} />
                <Detail label="Country" value={booking.country} />
                <Detail label="Customer type" value={booking.customer_type} />
              </DetailGroup>

              <DetailGroup title="Rate & channel">
                <Detail label="ADR" value={currency(booking.adr)} />
                <Detail label="Room type" value={booking.reserved_room_type} />
                <Detail label="Meal" value={booking.meal} />
                <Detail label="Deposit" value={booking.deposit_type} />
                <Detail label="Market segment" value={booking.market_segment} />
                <Detail label="Channel" value={booking.distribution_channel} />
                <Detail label="Agent" value={booking.agent === "0" ? "None" : booking.agent} />
                <Detail label="Parking spaces" value={booking.required_car_parking_spaces} />
                <Detail label="Special requests" value={booking.total_of_special_requests} />
              </DetailGroup>

              <p className="rounded-2xl bg-panel px-4 py-3 text-xs text-slate-500">
                Booking details are locked once recorded. Only the status can be changed.
              </p>
            </div>
          )}
        </div>

        {booking && (
          <footer className="border-t border-line bg-panel px-6 py-5">
            {confirmCancel ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">Cancel this booking? You can change the status again later.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setConfirmCancel(false)} disabled={saving}>
                    Keep booking
                  </Button>
                  <Button variant="danger" className="flex-1" onClick={cancel} loading={saving}>
                    Yes, cancel it
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="status-select" className="block text-[13px] font-medium text-slate-700">
                  Booking status
                </label>
                <div className="flex gap-2">
                  <Select id="status-select" className="flex-1" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {statusOptions.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <Button onClick={saveStatus} loading={saving} disabled={status === booking.booking_status} className="h-11!">
                    Save
                  </Button>
                </div>
                {!isCanceled && (
                  <Button variant="ghost" className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirmCancel(true)}>
                    <IconBan size={16} /> Cancel booking
                  </Button>
                )}
              </div>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-6 rounded-2xl bg-panel px-4 py-1">{children}</dl>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line py-2.5 text-sm last:border-0 [&:nth-last-child(2):nth-child(odd)]:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-800">{value === undefined || value === null || value === "" ? "—" : value}</dd>
    </div>
  );
}
