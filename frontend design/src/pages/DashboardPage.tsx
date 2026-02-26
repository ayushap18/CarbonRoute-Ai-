import React, { useState, useCallback } from 'react';
import { Cloud, AlertTriangle, Truck, Gauge, Activity, FileText, Map as MapIcon, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useFleet } from '../context/FleetContext';
import LiveMap from '../components/LiveMap';
import TwinCard, { TruckBadge, StatBox } from '../components/TwinCard';
import KpiCard from '../components/KpiCard';
import { api } from '../api';
import { badgeTextColor } from '../types';

export default function DashboardPage() {
  const { trucks, summary, connected, selectedTruck, setSelectedTruck, sortedTrucks, alerts } = useFleet();
  const [reportLoading, setReportLoading] = useState(false);
  const selTruck = selectedTruck ? trucks.find(t => t.truck_id === selectedTruck) ?? null : null;

  const downloadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const blob = await api.generateReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'verification_report.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to generate report.'); }
    setReportLoading(false);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-page-enter">
      {/* KPI Bar */}
      <div className="shrink-0 px-6 py-2.5 bg-surface-darker/80 backdrop-blur-sm border-b border-white/[0.04] flex items-center gap-3">
        <KpiCard icon={<Cloud size={13} />} label="CO2/hr" value={`${trucks.reduce((s, t) => s + t.co2_rate_kgph, 0).toFixed(1)} kg`} color="text-primary" />
        <KpiCard icon={<AlertTriangle size={13} />} label="Alerts" value={String(summary?.active_alerts ?? 0)} color={summary?.active_alerts ? 'text-accent-red' : 'text-primary'} />
        <KpiCard icon={<Truck size={13} />} label="Best" value={`${summary?.best_truck_id ?? '--'} (${summary?.best_truck_score ?? 0})`} color="text-primary" />
        <KpiCard icon={<Gauge size={13} />} label="Fleet Score" value={`${summary?.avg_green_score?.toFixed(0) ?? '0'}/100`} color="text-accent-blue" />
        <KpiCard icon={<Activity size={13} />} label="Active" value={`${summary?.active_trucks ?? 0}/${summary?.total_trucks ?? 0}`} color="text-white" />
        <div className="flex-1" />
        <button onClick={downloadReport} disabled={reportLoading}
          className="bg-primary hover:bg-primary-dark text-black px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer btn-press disabled:opacity-50">
          {reportLoading ? <span className="animate-spin w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full inline-block" /> : <FileText size={13} />}
          {reportLoading ? 'Generating...' : 'Export Report'}
        </button>
      </div>

      {/* Map + Twins Panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <LiveMap trucks={trucks} selectedTruck={selectedTruck} onSelectTruck={setSelectedTruck} />

          <div className="absolute top-4 left-4 z-10">
            <div className="bg-surface-darker/90 backdrop-blur-md rounded-lg px-3 py-2 border border-white/[0.06]">
              <div className="flex items-center gap-2">
                <MapIcon size={13} className="text-primary" />
                <span className="text-[11px] font-bold text-white">Live Fleet Tracker</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold ml-1">Delhi NCR</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-surface-darker/90 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/[0.06] flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-soft-pulse' : 'bg-accent-red'}`} />
              <span className="text-[10px] text-slate-300 font-medium">{connected ? 'LIVE' : 'OFFLINE'}</span>
              <span className="text-[10px] text-slate-500">{trucks.length} vehicles</span>
            </div>
          </div>

          {selTruck && (
            <div className="absolute top-4 right-4 z-10 w-64 animate-slide-in">
              <div className="bg-surface-darker/95 backdrop-blur-md rounded-xl border border-white/[0.06] p-3.5">
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-center gap-2">
                    <TruckBadge badge={selTruck.green_badge} />
                    <div>
                      <p className="text-white font-bold text-sm">Truck {selTruck.truck_id}</p>
                      <p className="text-[10px] text-slate-500">{selTruck.location_name}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedTruck(null)} className="text-slate-500 hover:text-white cursor-pointer"><XCircle size={15} /></button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <StatBox label="Score" value={`${selTruck.green_score}`} color={badgeTextColor(selTruck.green_badge)} />
                  <StatBox label="CO2/hr" value={`${selTruck.co2_rate_kgph.toFixed(1)} kg`} />
                  <StatBox label="Speed" value={`${selTruck.speed_kmph.toFixed(0)} km/h`} />
                  <StatBox label="Fuel" value={`${selTruck.fuel_rate_lph.toFixed(1)} L/h`} />
                  <StatBox label="Load" value={`${((selTruck.load_kg / selTruck.load_capacity_kg) * 100).toFixed(0)}%`} />
                  <StatBox label="CO2 Today" value={`${selTruck.co2_today_kg.toFixed(1)} kg`} />
                </div>
                {selTruck.active_alert && (
                  <div className="mt-2 text-[10px] text-accent-red bg-accent-red/10 px-2 py-1.5 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle size={11} /> {selTruck.active_alert}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Digital Twins Panel */}
        <div className="w-[330px] shrink-0 border-l border-white/[0.04] bg-surface-darker flex flex-col h-full overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Truck size={13} className="text-primary" />
              <span className="text-[11px] font-bold text-white">Digital Carbon Twins</span>
            </div>
            <span className="text-[10px] text-slate-500">{trucks.length} trucks</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {sortedTrucks.map((truck, i) => (
              <TwinCard key={truck.truck_id} truck={truck} selected={selectedTruck === truck.truck_id}
                onClick={() => setSelectedTruck(selectedTruck === truck.truck_id ? null : truck.truck_id)} delay={i * 40} />
            ))}
            {trucks.length === 0 && (
              <div className="text-center py-12 text-slate-600">
                <Truck size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs">Waiting for fleet data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
