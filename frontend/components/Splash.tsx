"use client";

import { useEffect, useState } from "react";
import { SPLASH_KEY } from "@/utils/boot";
import { LogoMark } from "./Logo";
import { Swirl } from "./Sidebar";
import { cx } from "./ui";

const SHOW_MS = 2100;
const EXIT_MS = 550;

/** Full-screen brand intro, shown once per browser session. */
export function Splash() {
  const [phase, setPhase] = useState<"show" | "leaving" | "done">("show");

  useEffect(() => {
    const seen = document.documentElement.dataset.splash === "seen";
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      // Storage unavailable; the splash just shows again next load.
    }
    const leave = setTimeout(() => setPhase("leaving"), seen ? 0 : SHOW_MS);
    const done = setTimeout(() => setPhase("done"), seen ? 0 : SHOW_MS + EXIT_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      id="splash"
      role="status"
      aria-label="Loading Booking Shield"
      className={cx(
        "fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-ink-950 text-white transition-all duration-500",
        phase === "leaving" && "pointer-events-none scale-[1.03] opacity-0",
      )}
    >
      <Swirl className="opacity-80" />
      <div className="splash-glow pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="relative">
          <span className="splash-ring absolute inset-0 rounded-full" />
          <LogoMark size={104} animated className="relative drop-shadow-[0_18px_40px_rgba(46,145,96,0.45)]" />
        </div>
        <h1 className="splash-word mt-8 text-[40px] font-semibold leading-none tracking-tight sm:text-5xl">
          Booking <span className="text-brand-300">Shield</span>
        </h1>
        <p className="splash-tag mt-3 text-[15px] text-white/60">Cancellation risk, caught early.</p>
        <div className="splash-tag mt-10 h-1 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="splash-progress h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-200" />
        </div>
      </div>
    </div>
  );
}
