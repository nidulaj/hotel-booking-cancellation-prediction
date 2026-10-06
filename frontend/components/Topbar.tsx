"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { MODEL_INFO } from "@/utils/constants";
import { HealthStatus } from "./HealthStatus";
import { IconSearch, IconSparkles } from "./Icons";

const noopSubscribe = () => () => {};

/** Desktop top bar: guest search (jumps to Bookings), system status and the active model. */
export function Topbar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const isMac = useSyncExternalStore(noopSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/bookings?email=${encodeURIComponent(q)}` : "/bookings");
    inputRef.current?.blur();
  }

  const auc = MODEL_INFO.metrics.find((m) => m.label === "ROC-AUC")?.value;

  return (
    <header className="hidden items-center justify-between gap-4 rounded-3xl bg-panel px-5 py-4 lg:flex">
      <form onSubmit={onSubmit} role="search" className="relative w-full max-w-sm">
        <IconSearch size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search bookings by guest email"
          placeholder="Search bookings by email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 w-full rounded-full bg-white pl-12 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-panel px-2 py-1 font-sans text-[11px] font-medium text-slate-500">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </form>

      <div className="flex items-center gap-3">
        <HealthStatus />
        <div className="flex items-center gap-3 pl-2">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-300 to-brand-700 text-white">
            <IconSparkles size={19} />
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-slate-900">{MODEL_INFO.name} model</p>
            <p className="text-[13px] text-slate-500">
              {auc !== undefined && `ROC-AUC ${auc.toFixed(3)} · `}threshold {MODEL_INFO.threshold.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
