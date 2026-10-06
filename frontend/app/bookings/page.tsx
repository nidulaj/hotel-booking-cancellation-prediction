"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BookingDrawer } from "@/components/BookingDrawer";
import { IconAlert, IconChevronLeft, IconChevronRight, IconList, IconRefresh, IconSearch, IconSparkles } from "@/components/Icons";
import { Select } from "@/components/Select";
import { Button, Card, EmptyState, Input, PageHeader, Skeleton, StatusBadge, buttonClass, cx } from "@/components/ui";
import { ApiError, api } from "@/services/api";
import type { Booking } from "@/services/types";
import { BOOKING_STATUSES, HOTELS } from "@/utils/constants";
import { RISK_META, arrivalLabel, currency, formatDateTime, percent, riskTier } from "@/utils/format";
import { usePredictions } from "@/utils/predictionStore";

const PAGE_SIZE = 20;

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsView />
    </Suspense>
  );
}

function BookingsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedId = params.get("id");
  // Filters can be seeded from the URL (top-bar search, dashboard cards).
  const urlEmail = params.get("email") ?? "";
  const urlStatus = params.get("status") ?? "";
  const urlHotel = params.get("hotel") ?? "";

  const [emailInput, setEmailInput] = useState(urlEmail);
  const [email, setEmail] = useState(urlEmail);
  const [status, setStatus] = useState(urlStatus);
  const [hotel, setHotel] = useState(urlHotel);
  const [page, setPage] = useState(0);

  // Follow later URL changes, e.g. a new top-bar search while already on this page.
  const [seen, setSeen] = useState({ urlEmail, urlStatus, urlHotel });
  if (seen.urlEmail !== urlEmail || seen.urlStatus !== urlStatus || seen.urlHotel !== urlHotel) {
    setSeen({ urlEmail, urlStatus, urlHotel });
    if (seen.urlEmail !== urlEmail) setEmailInput(urlEmail);
    if (seen.urlStatus !== urlStatus) setStatus(urlStatus);
    if (seen.urlHotel !== urlHotel) setHotel(urlHotel);
    setPage(0);
  }

  const [rows, setRows] = useState<Booking[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const predictions = usePredictions();

  // Debounce the email search.
  useEffect(() => {
    const t = setTimeout(() => {
      setEmail(emailInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [emailInput]);

  // Each distinct query gets a key; we're loading until the response for the current key arrives.
  const requestKey = JSON.stringify([page, email, status, hotel, nonce]);
  const loading = loadedKey !== requestKey;
  const load = () => setNonce((n) => n + 1);

  useEffect(() => {
    let alive = true;
    api
      .listBookings({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, email, status, hotel })
      .then((res) => {
        if (!alive) return;
        setRows(res.bookings);
        setTotal(res.total);
        setError(null);
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "Could not load bookings."))
      .finally(() => alive && setLoadedKey(requestKey));
    return () => {
      alive = false;
    };
  }, [requestKey, page, email, status, hotel]);

  const openBooking = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set("id", id);
      else next.delete("id");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const closeDrawer = useCallback(() => openBooking(null), [openBooking]);

  const filtersActive = !!(email || status || hotel);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every scored booking, newest first. Select a row to see details or change its status."
        action={
          <Link href="/predict" className={buttonClass("primary", "lg")}>
            <IconSparkles size={17} /> New prediction
          </Link>
        }
      />

      <Card>
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-line p-5 md:flex-row md:items-center">
          <div className="relative flex-1">
            <IconSearch size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              aria-label="Search by email"
              placeholder="Search by guest email"
              className="rounded-full! border-transparent! bg-panel! pl-11"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select aria-label="Filter by status" className="md:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              <option value="">All statuses</option>
              {BOOKING_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select aria-label="Filter by hotel" className="md:w-44" value={hotel} onChange={(e) => { setHotel(e.target.value); setPage(0); }}>
              <option value="">All hotels</option>
              {HOTELS.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" className="h-11! w-11 shrink-0 px-0!" onClick={load} aria-label="Refresh">
            <IconRefresh size={16} className={cx(loading && "animate-spin")} />
          </Button>
        </div>

        {/* Table */}
        {error ? (
          <EmptyState
            icon={<IconAlert />}
            title="Couldn't load bookings"
            description={error}
            action={<Button variant="secondary" onClick={load}>Try again</Button>}
          />
        ) : rows && rows.length === 0 && !loading ? (
          <EmptyState
            icon={<IconList />}
            title={filtersActive ? "No matching bookings" : "No bookings yet"}
            description={filtersActive ? "Try a different search or clear the filters." : "Run your first prediction to create a booking."}
            action={
              filtersActive ? (
                <Button variant="secondary" onClick={() => { setEmailInput(""); setStatus(""); setHotel(""); }}>
                  Clear filters
                </Button>
              ) : (
                <Link href="/predict" className={buttonClass("primary")}>
                  <IconSparkles size={16} /> New prediction
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">Guest</th>
                  <th className="px-3 py-3 font-medium">Hotel</th>
                  <th className="px-3 py-3 font-medium">Arrival</th>
                  <th className="px-3 py-3 text-right font-medium">Nights</th>
                  <th className="px-3 py-3 text-right font-medium">Guests</th>
                  <th className="px-3 py-3 text-right font-medium">ADR</th>
                  <th className="px-3 py-3 font-medium">Risk</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className={cx("divide-y divide-line transition-opacity", loading && rows && "opacity-50")}>
                {!rows
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={9} className="px-5 py-3.5">
                          <Skeleton className="h-6 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map((b) => {
                      const pred = predictions[b.id];
                      const tier = pred ? riskTier(pred.probability) : null;
                      return (
                        <tr
                          key={b.id}
                          tabIndex={0}
                          onClick={() => openBooking(b.id)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openBooking(b.id))}
                          className={cx("cursor-pointer transition hover:bg-panel focus:bg-panel focus:outline-none", selectedId === b.id && "bg-brand-50")}
                        >
                          <td className="px-5 py-3.5">
                            <p className="max-w-[220px] truncate font-medium text-slate-900">{b.email}</p>
                            <p className="font-mono text-[11px] text-slate-400">{b.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-3 py-3.5 text-slate-700">{b.hotel}</td>
                          <td className="px-3 py-3.5 text-slate-700">{arrivalLabel(b)}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{b.total_stay ?? "—"}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{b.total_guests ?? "—"}</td>
                          <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{currency(b.adr)}</td>
                          <td className="px-3 py-3.5">
                            {pred && tier ? (
                              <span className="flex items-center gap-2" title={RISK_META[tier].label}>
                                <span className="hatch-soft h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                                  <span className="block h-full rounded-full" style={{ width: percent(pred.probability), background: RISK_META[tier].hex }} />
                                </span>
                                <span className={cx("text-xs font-semibold tabular-nums", RISK_META[tier].text)}>{percent(pred.probability)}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400" title="Risk scores are only kept for predictions made in this browser">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusBadge status={b.booking_status} />
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDateTime(b.created_at)}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!error && total > 0 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3.5 text-sm text-slate-500">
            <span>
              <span className="font-medium text-slate-800">{from}–{to}</span> of {total}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <IconChevronLeft size={16} />
              </Button>
              <span className="px-2 tabular-nums">
                {page + 1} / {pages}
              </span>
              <Button variant="ghost" size="sm" disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <IconChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Risk scores appear for bookings predicted in this browser; the bookings database does not store the model&apos;s probability.
      </p>

      {selectedId && (
        <BookingDrawer
          key={selectedId}
          bookingId={selectedId}
          prediction={predictions[selectedId]}
          onClose={closeDrawer}
          onUpdated={(u) => setRows((rs) => rs?.map((r) => (r.id === u.id ? { ...r, ...u } : r)) ?? rs)}
        />
      )}
    </>
  );
}
