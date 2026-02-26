import React from 'react';

export default function BarChart({ data, maxValue, showValues = true }: {
  data: Array<{ label: string; value: number; color?: string }>;
  maxValue?: number;
  showValues?: boolean;
}) {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);

  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 animate-list-item" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="text-[10px] text-slate-400 w-8 shrink-0 text-right font-mono">{d.label}</span>
          <div className="flex-1 h-5 rounded bg-black/20 overflow-hidden">
            <div
              className="h-full rounded transition-all duration-700 flex items-center px-1.5"
              style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, backgroundColor: d.color ?? '#22c55e' }}
            >
              {showValues && <span className="text-[8px] font-bold text-white/90 whitespace-nowrap">{d.value.toFixed(1)}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
