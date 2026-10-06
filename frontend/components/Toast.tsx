"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { IconAlert, IconCheck, IconX } from "./Icons";
import { cx } from "./ui";

type Toast = { id: number; kind: "success" | "error"; message: string };

const ToastContext = createContext<(kind: Toast["kind"], message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => dismiss(id), 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-sm text-white shadow-xl shadow-ink-950/20"
          >
            <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", t.kind === "success" ? "bg-brand-500" : "bg-rose-500")}>
              {t.kind === "success" ? <IconCheck size={13} strokeWidth={2.6} /> : <IconAlert size={12} strokeWidth={2.4} />}
            </span>
            <p className="flex-1 leading-snug">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-white">
              <IconX size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
