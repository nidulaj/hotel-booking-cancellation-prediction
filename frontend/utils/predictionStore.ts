import { useMemo, useSyncExternalStore } from "react";

/**
 * The bookings table does not store the model's probability, so predictions made
 * in this browser are remembered locally to show a risk score next to those bookings.
 */
export interface StoredPrediction {
  bookingId: string;
  email: string;
  hotel: string;
  probability: number;
  prediction: 0 | 1;
  createdAt: string;
}

const KEY = "hbcp.predictions.v1";
const MAX = 200;

export function loadPredictions(): Record<string, StoredPrediction> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredPrediction>) : {};
  } catch {
    return {};
  }
}

export function savePrediction(p: StoredPrediction) {
  try {
    const all = loadPredictions();
    all[p.bookingId] = p;
    const trimmed = Object.values(all)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(trimmed.map((x) => [x.bookingId, x]))));
    listeners.forEach((l) => l());
  } catch {
    // Storage unavailable (private mode, quota); the score just won't be remembered.
  }
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function snapshot() {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Stored predictions keyed by booking ID; empty during server rendering. */
export function usePredictions(): Record<string, StoredPrediction> {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as Record<string, StoredPrediction>) : {};
    } catch {
      return {};
    }
  }, [raw]);
}
