import React, { useState } from 'react';
import { BarChart3, Truck, Cloud, Fuel, Navigation, Weight, Gauge, ArrowUpDown } from 'lucide-react';
import { useFleet } from '../context/FleetContext';
import { TruckBadge } from '../components/TwinCard';
import BarChart from '../components/BarChart';
import { badgeHexColor, badgeTextColor } from '../types';
import type { TruckState } from '../types';

type SortKey = 'green_score' | 'co2_today_kg' | 'speed_kmph' | 'fuel_rate_lph' | 'load_pct';

export default function AnalyticsPage() {
  const { trucks, summary } = useFleet();
  const [sortKey, setSortKey] = useState<SortKey>('green_score');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const getValue = (t: TruckState, key: SortKey): number => {
    if (key === 'load_pct') return (t.load_kg / t.load_capacity_kg) * 100;
    return t[key] as number;
  };

  const sorted = [...trucks].sort((a, b) => {
    const diff = getValue(a, sortKey) - getValue(b, sortKey);
    return sortAsc ? diff : -diff;
  });

  const avgFuel = trucks.length ? trucks.reduce((s, t) => s + t.fuel_rate_lph, 0) / trucks.length : 0;
  const totalDist = trucks.reduce((s, t) => s + t.total_distance_km, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-page-enter">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 size={20} className="text-primary" />
        <h2 className="text-white text-lg font-bold">Fleet Analytics</h2>
        <span className="text-[10px] text-slate-500 ml-2">{trucks.length} trucks active</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Avg Score', value: `${summary?.avg_green_score?.toFixed(0) ?? '0'}`, unit: '/100', icon: <Gauge size={14} />, color: 'text-primary' },
          { label: 'Total CO2', value: `${summary?.total_co2_today?.toFixed(1) ?? '0'}`, unit: ' kg', icon: <Cloud size={14} />, color: 'text-primary' },
          { label: 'Avg Fuel Rate', value: avgFuel.toFixed(1), unit: ' L/h', icon: <Fuel size={14} />, color: 'text-accent-yellow' },
          { label: 'Total Distance', value: totalDist.toFixed(1), unit: ' km', icon: <Navigation size={14} />, color: 'text-accent-blue' },
          { label: 'Avg Load', value: `${trucks.length ? (trucks.reduce((s, t) => s + (t.load_kg / t.load_capacity_kg) * 100, 0) / trucks.length).toFixed(0) : '0'}`, unit: '%', icon: <Weight size={14} />, color: 'text-white' },
        ].map((item, i) => (
          <div key={i} className="bg-surface-card border border-white/[0.04] rounded-xl p-4 animate-list-item" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className={item.color}>{item.icon}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{item.label}</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{item.value}<span className="text-sm text-slate-500 font-normal">{item.unit}</span></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <Truck size={14} className="text-primary" /> Fleet Leaderboard
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {[
                    { key: 'green_score', label: 'Score' },
                    { key: 'co2_today_kg', label: 'CO2 (kg)' },
                    { key: 'speed_kmph', label: 'Speed' },
                    { key: 'fuel_rate_lph', label: 'Fuel' },
                    { key: 'load_pct', label: 'Load' },
                  ].map(col => (
                    <th key={col.key} className="text-left text-slate-500 font-semibold py-2 px-1 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort(col.key as SortKey)}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && <ArrowUpDown size={9} className="text-primary" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr key={t.truck_id} className="border-b border-white/[0.03] hover:bg-white/[0.02] animate-list-item" style={{ animationDelay: `${i * 40}ms` }}>
                    <td className="py-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <TruckBadge badge={t.green_badge} />
                        <span className="text-white font-bold">{t.truck_id}</span>
                        <span className={`font-bold ${badgeTextColor(t.green_badge)}`}>{t.green_score}</span>
                      </div>
                    </td>
                    <td className="py-2 px-1 text-slate-300 tabular-nums">{t.co2_today_kg.toFixed(1)}</td>
                    <td className="py-2 px-1 text-slate-300 tabular-nums">{t.speed_kmph.toFixed(0)} km/h</td>
                    <td className="py-2 px-1 text-slate-300 tabular-nums">{t.fuel_rate_lph.toFixed(1)} L/h</td>
                    <td className="py-2 px-1 text-slate-300 tabular-nums">{((t.load_kg / t.load_capacity_kg) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CO2 Comparison */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <Cloud size={14} className="text-primary" /> CO2 Emissions Today
          </h3>
          <BarChart data={[...trucks].sort((a, b) => b.co2_today_kg - a.co2_today_kg).map(t => ({
            label: t.truck_id,
            value: t.co2_today_kg,
            color: badgeHexColor(t.green_badge),
          }))} />
        </div>

        {/* Green Score Breakdown */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <Gauge size={14} className="text-primary" /> Green Score Breakdown
          </h3>
          <div className="flex flex-col gap-3">
            {trucks.map((t, i) => {
              const loadPct = t.load_kg / t.load_capacity_kg;
              const idlePen = Math.min((t.idle_seconds / 60) * 3, 30);
              const fuelPen = avgFuel > 0 ? Math.min(Math.max(0, ((t.fuel_rate_lph / avgFuel) - 1) * 100) * 0.6, 30) : 0;
              const loadPen = Math.min((1 - loadPct) * 20, 20);
              const devPen = t.active_alert?.includes('DEVIATION') ? 15 : 0;
              const total = 100;

              return (
                <div key={t.truck_id} className="animate-list-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-400 w-6 font-mono">{t.truck_id}</span>
                    <span className={`text-[10px] font-bold ${badgeTextColor(t.green_badge)}`}>{t.green_score}</span>
                  </div>
                  <div className="h-3 rounded-full bg-black/20 overflow-hidden flex">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${t.green_score}%` }} title="Score" />
                    {idlePen > 0 && <div className="h-full bg-accent-blue" style={{ width: `${(idlePen / total) * 100}%` }} title={`Idle: -${idlePen.toFixed(0)}`} />}
                    {fuelPen > 0 && <div className="h-full bg-accent-yellow" style={{ width: `${(fuelPen / total) * 100}%` }} title={`Fuel: -${fuelPen.toFixed(0)}`} />}
                    {devPen > 0 && <div className="h-full bg-accent-red" style={{ width: `${(devPen / total) * 100}%` }} title={`Deviation: -${devPen}`} />}
                    {loadPen > 0 && <div className="h-full bg-orange-500" style={{ width: `${(loadPen / total) * 100}%` }} title={`Load: -${loadPen.toFixed(0)}`} />}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-3 mt-2 text-[9px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary" />Score</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent-blue" />Idle</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent-yellow" />Fuel</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent-red" />Deviation</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500" />Load</span>
            </div>
          </div>
        </div>

        {/* Speed vs Fuel Scatter */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <Navigation size={14} className="text-accent-blue" /> Speed vs Fuel Correlation
          </h3>
          <div className="relative h-52 bg-black/20 rounded-lg overflow-hidden">
            {/* Axes */}
            <div className="absolute bottom-0 left-8 right-2 h-px bg-white/10" />
            <div className="absolute top-2 bottom-0 left-8 w-px bg-white/10" />
            <span className="absolute bottom-1 left-1/2 text-[8px] text-slate-600">Speed (km/h)</span>
            <span className="absolute top-1/2 left-0 text-[8px] text-slate-600 -rotate-90 origin-center">Fuel</span>

            {trucks.map(t => {
              const maxSpeed = Math.max(...trucks.map(t => t.speed_kmph), 50);
              const maxFuel = Math.max(...trucks.map(t => t.fuel_rate_lph), 8);
              const x = 8 + (t.speed_kmph / maxSpeed) * 85;
              const y = 95 - (t.fuel_rate_lph / maxFuel) * 85;
              const size = 8 + ((t.load_kg / t.load_capacity_kg) * 16);
              return (
                <div key={t.truck_id} className="absolute transition-all duration-700 flex flex-col items-center"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div className="rounded-full border border-white/30" style={{
                    width: size, height: size, backgroundColor: badgeHexColor(t.green_badge),
                    boxShadow: `0 0 8px ${badgeHexColor(t.green_badge)}50`,
                  }} />
                  <span className="text-[8px] text-white font-bold mt-0.5">{t.truck_id}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-slate-600 mt-2">Bubble size = load utilization</p>
        </div>
      </div>
    </div>
  );
}
