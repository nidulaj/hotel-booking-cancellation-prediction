"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import type { HealthResponse } from "@/services/types";
import { IconPulse } from "./Icons";
import { cx } from "./ui";

type State = { status: "loading" } | { status: "ok"; data: HealthResponse } | { status: "down" };

const POLL_MS = 30_000;

/** Round icon button in the top bar; its dot summarises API health and it opens a per-service breakdown. */
export function HealthStatus() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .health()
        .then((data) => alive && setState({ status: "ok", data }))
        .catch(() => alive && setState({ status: "down" }));
    check();
    const t = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows =
    state.status === "ok"
      ? [
          { label: "API", ok: true },
          { label: "ML model", ok: state.data.model_loaded },
          { label: "Database", ok: state.data.database_connected },
        ]
      : [
          { label: "API", ok: state.status === "loading" ? null : false },
          { label: "ML model", ok: null },
          { label: "Database", ok: null },
        ];

  const overall = state.status === "loading" ? null : rows.every((r) => r.ok) ? "ok" : rows[0].ok ? "degraded" : "down";
  const summary = overall === null ? "Checking services" : overall === "ok" ? "All systems online" : overall === "degraded" ? "Partially available" : "API offline";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`System status: ${summary}`}
        title={summary}
        className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700 transition hover:text-brand-700"
      >
        <IconPulse size={19} />
        <span
          className={cx(
            "absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
            overall === null ? "bg-slate-300" : overall === "ok" ? "bg-brand-500" : overall === "degraded" ? "bg-amber-500" : "bg-rose-500",
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 animate-pop rounded-2xl bg-white p-4 shadow-xl shadow-ink-950/10 ring-1 ring-line">
          <p className="text-sm font-semibold text-slate-900">System status</p>
          <p className="mb-3 text-xs text-slate-500">{summary} · refreshes every 30s</p>
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600">{r.label}</span>
                <span
                  className={cx(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    r.ok === null ? "text-slate-500 ring-slate-200" : r.ok ? "bg-brand-50 text-brand-700 ring-brand-300" : "bg-rose-50 text-rose-600 ring-rose-300",
                  )}
                >
                  {r.ok === null ? (state.status === "loading" ? "Checking" : "Unknown") : r.ok ? "Online" : "Offline"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
