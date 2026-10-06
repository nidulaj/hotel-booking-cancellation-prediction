"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { parseDateInput, toDateInput } from "@/utils/format";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "./Icons";
import { usePopover } from "./Select";
import { controlClass, cx } from "./ui";

const PANEL = { height: 410, width: 328 };
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getTime() === b.getTime();
/** Same day-of-month in another month, clamped to that month's length (31 Jan + 1 month = 28/29 Feb). */
function addMonths(d: Date, n: number) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
}

/** Six Monday-first weeks covering the month that contains `month`. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
}

const longLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/**
 * Calendar date picker matching the app's design. Value is "YYYY-MM-DD" like a native date input.
 * `nights` shades the stay that follows the chosen date, ending on the check-out day.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  invalid,
  nights = 0,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  invalid?: boolean;
  nights?: number;
}) {
  const selected = parseDateInput(value);
  const minDate = min ? parseDateInput(min) : null;
  const checkout = selected && nights > 0 ? addDays(selected, nights) : null;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months">("days");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridId = `${useId()}-grid`;
  const close = useCallback(() => setOpen(false), []);
  const anchor = useCallback(() => buttonRef.current, []);
  const { ref, panelRef, style, place } = usePopover<HTMLDivElement>(open, close, anchor, PANEL);

  const disabled = (d: Date) => !!minDate && d < minDate;
  const today = startOfDay(new Date());

  // Keep keyboard focus on the highlighted day while the grid is showing.
  useEffect(() => {
    if (open && mode === "days") panelRef.current?.querySelector<HTMLButtonElement>(`[data-day="${toDateInput(cursor)}"]`)?.focus();
  }, [open, mode, cursor, panelRef]);

  function show() {
    const start = selected ?? (minDate && minDate > today ? minDate : today);
    setCursor(start);
    setMode("days");
    place();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function pick(d: Date) {
    if (disabled(d)) return;
    onChange(toDateInput(d));
    hide();
  }

  function onGridKey(e: KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -((cursor.getDay() + 6) % 7)),
      End: () => addDays(cursor, 6 - ((cursor.getDay() + 6) % 7)),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCursor(moves[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(cursor);
    }
  }

  function onPanelKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't also close a surrounding drawer
      if (mode === "months") setMode("days");
      else hide();
    } else if (e.key === "Tab" && mode === "days") {
      // Keep it simple: Tab leaves the calendar.
      setOpen(false);
    }
  }

  const days = monthGrid(cursor);
  const monthTitle = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const prevDisabled = !!minDate && new Date(cursor.getFullYear(), cursor.getMonth(), 0) < minDate;
  const navBtn =
    "grid h-8 w-8 place-items-center rounded-full text-slate-600 ring-1 ring-line transition hover:bg-brand-50 hover:text-brand-800 disabled:pointer-events-none disabled:opacity-30";

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            show();
          }
        }}
        className={cx(
          controlClass(invalid),
          "flex items-center justify-between gap-2 pr-2 text-left",
          open && !invalid && "border-brand-400 ring-4 ring-brand-100",
        )}
      >
        <span className={cx("truncate", !selected && "text-slate-400")}>{selected ? longLabel(selected) : "Choose a date"}</span>
        <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full transition", open ? "bg-brand-700 text-white" : "bg-panel text-slate-500")}>
          <IconCalendar size={15} strokeWidth={2} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose arrival date"
            style={style}
            onKeyDown={onPanelKey}
            className="z-[70] animate-pop rounded-3xl bg-white p-4 shadow-[0_18px_40px_-12px_rgba(10,36,24,0.28)] ring-1 ring-line"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMode((m) => (m === "days" ? "months" : "days"))}
                aria-label={mode === "days" ? "Choose month and year" : "Back to days"}
                className="rounded-full px-2.5 py-1 text-[15px] font-semibold tracking-tight text-slate-900 transition hover:bg-panel"
              >
                {mode === "days" ? monthTitle : cursor.getFullYear()}
              </button>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={navBtn}
                  aria-label={mode === "days" ? "Previous month" : "Previous year"}
                  disabled={mode === "days" ? prevDisabled : !!minDate && cursor.getFullYear() <= minDate.getFullYear()}
                  onClick={() => setCursor((c) => addMonths(c, mode === "days" ? -1 : -12))}
                >
                  <IconChevronLeft size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={navBtn}
                  aria-label={mode === "days" ? "Next month" : "Next year"}
                  onClick={() => setCursor((c) => addMonths(c, mode === "days" ? 1 : 12))}
                >
                  <IconChevronRight size={16} strokeWidth={2.2} />
                </button>
              </div>
            </div>

            {mode === "days" ? (
              <>
                <div className="mt-4 grid grid-cols-7 text-center text-xs font-medium text-slate-400">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="py-1">
                      {w}
                    </span>
                  ))}
                </div>
                <div id={gridId} role="group" aria-label={monthTitle} onKeyDown={onGridKey} className="mt-1 grid grid-cols-7 gap-y-1">
                  {days.map((d) => {
                    const inMonth = d.getMonth() === cursor.getMonth();
                    const isSelected = sameDay(d, selected);
                    const isCheckout = sameDay(d, checkout);
                    const inStay = !!selected && !!checkout && d > selected && d < checkout;
                    const off = disabled(d);
                    const isCursor = sameDay(d, cursor);
                    // Stay band: a soft strip joining arrival to check-out.
                    const band = !!checkout && (inStay || (isSelected && nights > 0) || isCheckout);
                    return (
                      <div
                        key={d.getTime()}
                        className={cx(
                          "flex justify-center",
                          band && "bg-brand-50",
                          band && isSelected && "rounded-l-full",
                          band && isCheckout && "rounded-r-full",
                          band && d.getDay() === 1 && "rounded-l-full",
                          band && d.getDay() === 0 && "rounded-r-full",
                        )}
                      >
                        <button
                          type="button"
                          data-day={toDateInput(d)}
                          tabIndex={isCursor ? 0 : -1}
                          aria-pressed={isSelected}
                          aria-disabled={off || undefined}
                          aria-label={`${longLabel(d)}${isCheckout ? ", check-out" : ""}${off ? ", unavailable" : ""}`}
                          onClick={() => pick(d)}
                          onMouseDown={(e) => e.preventDefault()}
                          className={cx(
                            "relative grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition focus:outline-none",
                            isSelected
                              ? "bg-gradient-to-b from-brand-600 to-brand-800 font-semibold text-white shadow-[0_6px_14px_-6px_rgba(19,78,50,0.7)]"
                              : isCheckout
                                ? "font-semibold text-brand-800 ring-2 ring-inset ring-brand-600"
                                : off
                                  ? "cursor-not-allowed text-slate-300"
                                  : inMonth
                                    ? "text-slate-800 hover:bg-panel"
                                    : "text-slate-300 hover:bg-panel",
                            inStay && !off && "text-brand-800",
                            isCursor && !isSelected && "ring-2 ring-brand-300",
                          )}
                        >
                          {d.getDate()}
                          {sameDay(d, today) && !isSelected && (
                            <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-600" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {MONTHS_SHORT.map((m, i) => {
                  const lastDay = new Date(cursor.getFullYear(), i + 1, 0);
                  const off = !!minDate && lastDay < minDate;
                  const current = i === cursor.getMonth();
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={off}
                      onClick={() => {
                        setCursor(addMonths(cursor, i - cursor.getMonth()));
                        setMode("days");
                      }}
                      className={cx(
                        "h-12 rounded-2xl text-sm font-medium transition disabled:cursor-not-allowed disabled:text-slate-300",
                        current ? "bg-gradient-to-b from-brand-600 to-brand-800 text-white" : "bg-panel text-slate-700 hover:bg-brand-50 hover:text-brand-800",
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="min-w-0 truncate text-xs text-slate-500">
                {checkout && selected ? (
                  <>
                    <span className="font-medium text-slate-700">{nights} night{nights === 1 ? "" : "s"}</span> · out{" "}
                    {checkout.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </>
                ) : (
                  "Pick the arrival day"
                )}
              </p>
              <button
                type="button"
                disabled={disabled(today)}
                onClick={() => pick(today)}
                className="h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium text-brand-900 ring-1 ring-inset ring-brand-800/80 transition hover:bg-brand-50 disabled:opacity-40"
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
