"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { toggleSidebar, useSidebarCollapsed } from "@/utils/sidebarStore";
import { HealthStatus } from "./HealthStatus";
import { IconChevronLeft, IconDashboard, IconList, IconMenu, IconSparkles, IconX } from "./Icons";
import { Logo } from "./Logo";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: IconDashboard },
  { href: "/predict", label: "New prediction", icon: IconSparkles },
  { href: "/bookings", label: "Bookings", icon: IconList },
];

const noopSubscribe = () => () => {};

/** Label shown beside an icon when the rail is collapsed and the item is hovered or focused. */
function RailTooltip({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-4 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg collapsed:group-hover:block collapsed:group-focus-visible:block">
      {children}
    </span>
  );
}

/** Dark feature card at the bottom of the sidebar; shrinks to a round button on the collapsed rail. */
export function FeatureCard({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-5 text-white collapsed:hidden">
        <Swirl />
        <div className="relative">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-brand-800">
            <IconSparkles size={16} />
          </span>
          <p className="mt-4 text-lg font-semibold leading-snug">Score a new booking</p>
          <p className="mt-1 text-xs text-white/60">Cancellation risk in a few seconds</p>
          <Link
            href="/predict"
            onClick={onNavigate}
            className="mt-6 flex h-10 items-center justify-center rounded-full bg-gradient-to-b from-brand-600 to-brand-800 text-sm font-medium transition hover:from-brand-500 hover:to-brand-700"
          >
            Start prediction
          </Link>
        </div>
      </div>
      <Link
        href="/predict"
        onClick={onNavigate}
        aria-label="Start prediction"
        className="group relative mx-auto hidden h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-brand-600 to-ink-950 text-white shadow-[0_8px_20px_-8px_rgba(19,78,50,0.8)] transition hover:scale-105 collapsed:grid"
      >
        <IconSparkles size={19} />
        <RailTooltip>Start prediction</RailTooltip>
      </Link>
    </>
  );
}

/** Flowing contour lines used as texture on dark green cards. */
export function Swirl({ className }: { className?: string }) {
  const id = `swirl${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className={cx("pointer-events-none absolute inset-0 h-full w-full", className)} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={id} cx="80%" cy="90%" r="75%">
          <stop offset="0%" stopColor="#2e9160" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0a2418" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${id})`} />
      {Array.from({ length: 9 }).map((_, i) => (
        <path
          key={i}
          d={`M ${-20 + i * 6} 210 C ${40 + i * 8} ${120 - i * 6}, ${120 - i * 4} ${180 - i * 10}, ${220} ${40 + i * 12}`}
          fill="none"
          stroke="#4cab76"
          strokeOpacity={0.1 + i * 0.025}
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

function NavContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} aria-label="Booking Shield home" className="px-2 collapsed:flex collapsed:justify-center collapsed:px-0">
        <Logo size={38} wordmarkClassName="collapsed:hidden" />
      </Link>

      <p className="mt-10 px-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-400 collapsed:hidden">Menu</p>
      <span className="mx-auto mt-12 hidden h-px w-8 bg-slate-300 collapsed:block" aria-hidden />
      <nav className="mt-3 space-y-1" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cx(
                "group relative flex items-center gap-3.5 rounded-xl px-2 py-2.5 text-[15px] transition collapsed:justify-center collapsed:px-0 collapsed:py-3",
                active ? "font-semibold text-slate-900" : "text-slate-400 hover:text-slate-700",
                !active && "collapsed:hover:bg-white",
              )}
            >
              {active && <span className="absolute -left-5 top-1/2 h-9 w-1.5 -translate-y-1/2 rounded-r-full bg-brand-700 collapsed:-left-3" />}
              <Icon size={20} className={cx("shrink-0", active ? "text-brand-700" : "text-slate-400 group-hover:text-slate-600")} />
              <span className="whitespace-nowrap collapsed:hidden">{label}</span>
              <RailTooltip>{label}</RailTooltip>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8">
        <FeatureCard onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/** Small round chevron on the rail's edge; also bound to Ctrl/⌘ + B. */
function CollapseToggle() {
  const collapsed = useSidebarCollapsed();
  const isMac = useSyncExternalStore(noopSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  const label = `${collapsed ? "Expand" : "Collapse"} sidebar (${isMac ? "⌘" : "Ctrl"}+B)`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        const t = e.target as HTMLElement | null;
        if (t?.isContentEditable) return;
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="absolute -right-3.5 top-10 z-10 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-500 shadow-[0_2px_8px_rgba(16,24,20,0.12)] ring-1 ring-line transition hover:scale-110 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <IconChevronLeft size={15} strokeWidth={2.2} className="transition-transform duration-300 collapsed:rotate-180" />
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: collapsible rail */}
      <aside className="sb-rail sticky top-6 z-20 hidden h-[calc(100vh-48px)] w-64 shrink-0 rounded-3xl bg-panel transition-[width] duration-300 ease-out collapsed:w-[84px] lg:block">
        <div className="h-full overflow-y-auto overflow-x-hidden px-5 py-7 collapsed:overflow-visible collapsed:px-3">
          <NavContent pathname={pathname} />
        </div>
        <CollapseToggle />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" aria-label="Booking Shield home">
          <Logo size={32} />
        </Link>
        <div className="flex items-center gap-2">
          <HealthStatus />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-700"
          >
            <IconMenu />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 overflow-y-auto bg-panel px-5 py-7">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-white"
            >
              <IconX />
            </button>
            <NavContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
