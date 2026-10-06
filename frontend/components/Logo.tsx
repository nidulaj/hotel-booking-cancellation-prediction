"use client";

import { useId } from "react";
import { cx } from "./ui";

/** Shield outline in a 48×48 box. */
export const SHIELD_PATH = "M24 3.5 40.5 9.6V22c0 10.6-7 18.6-16.5 22.5C14.5 40.6 7.5 32.6 7.5 22V9.6z";
const SHIELD_LEFT = "M24 3.5 7.5 9.6V22c0 10.6 7 18.6 16.5 22.5z";
const CHECK_PATH = "M16 24.2l5.6 5.6L32.5 18.6";

/**
 * Booking Shield mark: a faceted green shield with a check, meaning a booking that's protected.
 * `animated` plays the draw-in sequence used on the splash screen.
 */
export function LogoMark({ size = 40, animated, className }: { size?: number; animated?: boolean; className?: string }) {
  const id = `bs${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-fill`} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3aa36d" />
          <stop offset="0.55" stopColor="#1f7a4d" />
          <stop offset="1" stopColor="#0f3322" />
        </linearGradient>
      </defs>
      <g className={cx(animated && "splash-fill")}>
        <path d={SHIELD_PATH} fill={`url(#${id}-fill)`} />
        <path d={SHIELD_LEFT} fill="#fff" fillOpacity="0.13" />
      </g>
      {animated && (
        <path className="splash-outline" d={SHIELD_PATH} pathLength={1} stroke="#77c496" strokeWidth="1.2" strokeLinejoin="round" />
      )}
      <path
        className={cx(animated && "splash-check")}
        d={CHECK_PATH}
        pathLength={1}
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark + wordmark. */
export function Logo({
  size = 38,
  className,
  wordmarkClassName,
  inverted,
}: {
  size?: number;
  className?: string;
  wordmarkClassName?: string;
  inverted?: boolean;
}) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <LogoMark size={size} className="shrink-0" />
      <span
        className={cx("whitespace-nowrap font-semibold tracking-tight", inverted ? "text-white" : "text-slate-900", wordmarkClassName)}
        style={{ fontSize: Math.round(size * 0.55) }}
      >
        Booking <span className={inverted ? "text-brand-300" : "text-brand-600"}>Shield</span>
      </span>
    </span>
  );
}
