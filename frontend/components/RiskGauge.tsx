"use client";

import { useEffect, useState } from "react";
import { RISK_META, riskTier } from "@/utils/format";

/** Semicircular gauge for a 0–1 cancellation probability, animated on mount. */
export function RiskGauge({ probability, size = 240 }: { probability: number; size?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(probability * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [probability]);

  const tier = riskTier(probability);
  const meta = RISK_META[tier];
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arc = Math.PI * r;
  const h = size / 2 + stroke;

  // Threshold tick at 0.5 (the model's decision boundary) sits at the top of the arc.
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: h }}>
        <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} role="img" aria-label={`Cancellation probability ${Math.round(probability * 100)} percent`}>
          <defs>
            <linearGradient id="gauge-track" x1="0" x2="1">
              <stop offset="0%" stopColor="#1f7a4d" stopOpacity="0.16" />
              <stop offset="50%" stopColor="#e09a00" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#e5484d" stopOpacity="0.16" />
            </linearGradient>
          </defs>
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke="url(#gauge-track)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke={meta.hex}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc * shown} ${arc}`}
          />
          <line x1={cx} y1={stroke + 4} x2={cx} y2={stroke + 14} stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-x-0 bottom-2 text-center text-[52px] font-semibold leading-none tabular-nums tracking-tight text-slate-900">
          {Math.round(shown * 100)}
          <span className="text-2xl text-slate-400">%</span>
        </span>
      </div>
      <span className="mt-2 text-sm text-slate-500">chance of cancellation</span>
    </div>
  );
}
