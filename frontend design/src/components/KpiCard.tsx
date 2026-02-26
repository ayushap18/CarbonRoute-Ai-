import React from 'react';
import { useAnimatedCounter } from '../hooks/useAnimatedCounter';

export default function KpiCard({ icon, label, value, color, numericValue }: {
  icon: React.ReactNode; label: string; value: string; color: string; numericValue?: number;
}) {
  const animVal = useAnimatedCounter(numericValue ?? 0);
  const displayVal = numericValue !== undefined ? animVal.toFixed(1) : value;

  return (
    <div className="flex items-center gap-2 bg-surface-dark/60 rounded-lg px-2.5 py-1.5 border border-white/[0.04]">
      <span className={color}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold leading-none">{label}</span>
        <span className={`text-[11px] font-bold leading-tight tabular-nums ${color}`}>{numericValue !== undefined ? displayVal : value}</span>
      </div>
    </div>
  );
}
