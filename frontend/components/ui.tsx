"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { IconArrowUpRight, IconMinus, IconPlus } from "./Icons";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-3xl bg-white shadow-[0_1px_2px_rgba(16,24,20,0.03)]", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">{icon}</div>}
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Round outlined arrow used as the "open" affordance on stat cards. */
export function ArrowBadge({ inverted, className }: { inverted?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full transition group-hover:rotate-45",
        inverted ? "bg-white text-brand-800" : "bg-white text-slate-900 ring-1 ring-slate-900/80",
        className,
      )}
    >
      <IconArrowUpRight size={16} strokeWidth={2} />
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const BUTTON_VARIANTS = {
  primary:
    "bg-gradient-to-b from-brand-600 to-brand-800 text-white shadow-[0_6px_16px_-6px_rgba(19,78,50,0.6)] hover:from-brand-700 hover:to-brand-900",
  secondary: "bg-white text-brand-900 ring-1 ring-inset ring-brand-800/80 hover:bg-brand-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
};
const BUTTON_SIZES = { sm: "h-8 px-3.5 text-sm", md: "h-10 px-5 text-sm", lg: "h-12 px-7 text-[15px]" };

/** Button styling, exported so links can look like buttons. */
export function buttonClass(
  variant: keyof typeof BUTTON_VARIANTS = "primary",
  size: keyof typeof BUTTON_SIZES = "md",
  className?: string,
) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  "block w-full rounded-2xl border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-4";

export function controlClass(invalid?: boolean) {
  return cx(
    controlBase,
    "h-11",
    invalid
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
      : "border-line hover:border-slate-300 focus:border-brand-400 focus:ring-brand-100",
  );
}

export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx(controlClass(invalid), className)} aria-invalid={invalid || undefined} {...rest} />;
}

/** Segmented control for small, bounded choices. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex rounded-full bg-panel p-1 ring-1 ring-inset ring-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex-1 rounded-full px-3 py-2 text-sm font-medium transition",
              active ? "bg-gradient-to-b from-brand-600 to-brand-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  invalid,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  invalid?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div
      className={cx(
        "flex h-11 items-center justify-between rounded-2xl border bg-white px-1.5",
        invalid ? "border-rose-300" : "border-line",
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-brand-50 hover:text-brand-800 disabled:opacity-30"
      >
        <IconMinus size={16} />
      </button>
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums text-slate-900 focus:outline-none"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-brand-50 hover:text-brand-800 disabled:opacity-30"
      >
        <IconPlus size={16} />
      </button>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-200/60", className)} />;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const style = s.includes("cancel")
    ? "bg-rose-50 text-rose-600 ring-rose-300"
    : s === "confirmed"
      ? "bg-brand-50 text-brand-700 ring-brand-300"
      : s.includes("no-show")
        ? "bg-amber-50 text-amber-700 ring-amber-300"
        : "bg-slate-50 text-slate-600 ring-slate-300";
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", style)}>
      {status || "Unknown"}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">{icon}</div>
      <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-[13px] font-medium text-brand-600">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[40px] sm:leading-[1.1]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-3">{action}</div>}
    </div>
  );
}
