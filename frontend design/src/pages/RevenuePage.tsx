import React, { useState, useEffect, useCallback } from 'react';
import { PiggyBank, Download, TrendingUp, Truck, Fuel, DollarSign, FileText, Calculator } from 'lucide-react';
import { api } from '../api';
import { useFleet } from '../context/FleetContext';
import type { RevenueCalcResult } from '../types';

function SliderInput({ label, value, min, max, step = 1, onChange, suffix = '', prefix = '' }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string; prefix?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-mono font-bold">{prefix}{step < 1 ? value.toFixed(1) : value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full cursor-pointer" />
    </div>
  );
}

function RevStat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean; }) {
  return (
    <div>
      <p className="text-[8px] text-slate-500 uppercase mb-0.5">{label}</p>
      <p className={`text-base font-bold leading-tight ${highlight ? 'text-primary' : 'text-white'}`}>{value}<span className="text-[9px] text-slate-500 font-normal ml-0.5">{unit}</span></p>
    </div>
  );
}

export default function RevenuePage() {
  const { summary, trucks } = useFleet();
  const [result, setResult] = useState<RevenueCalcResult | null>(null);
  const [revTrucks, setRevTrucks] = useState(100);
  const [revLiters, setRevLiters] = useState(2.0);
  const [revPrice, setRevPrice] = useState(5);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try { const r = await api.calculateRevenue(revTrucks, revLiters, revPrice); setResult(r); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [revTrucks, revLiters, revPrice]);

  const downloadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const blob = await api.generateReport(revTrucks, revLiters, revPrice);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'verification_report.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to generate report.'); }
    setReportLoading(false);
  }, [revTrucks, revLiters, revPrice]);

  const dailyKg = result?.daily_co2_saved_kg ?? 0;
  const annualTonnes = result?.annual_tonnes_saved ?? 0;
  const grossRev = result?.gross_annual_revenue ?? 0;
  const platformRev = result?.platform_revenue ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-page-enter">
      <div className="flex items-center gap-2 mb-6">
        <PiggyBank size={20} className="text-accent-yellow" />
        <h2 className="text-white text-lg font-bold">Carbon Credit Revenue</h2>
        <span className="text-[10px] text-slate-500 ml-2">Monetize your fleet's efficiency gains</span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Calculator Panel */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-5">
          <h3 className="text-white text-[13px] font-bold mb-5 flex items-center gap-2">
            <Calculator size={14} className="text-accent-yellow" /> Revenue Calculator
          </h3>
          <div className="flex flex-col gap-6">
            <SliderInput label="Active Trucks" value={revTrucks} min={1} max={500} onChange={setRevTrucks} />
            <SliderInput label="Liters Saved / Truck / Day" value={revLiters} min={0.5} max={5} step={0.1} onChange={setRevLiters} suffix=" L" />
            <SliderInput label="Price per tCO2e" value={revPrice} min={1} max={20} onChange={setRevPrice} prefix="$" />
          </div>

          <div className="mt-6 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/15 p-4">
            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest mb-3">Projected Annual</p>
            <div className="grid grid-cols-2 gap-4">
              <RevStat label="Tonnes Saved" value={annualTonnes.toFixed(1)} unit="tCO2/yr" />
              <RevStat label="Gross Revenue" value={`$${grossRev.toFixed(0)}`} unit="/year" highlight />
              <RevStat label="Daily CO2 Saved" value={dailyKg.toFixed(0)} unit="kg/day" />
              <RevStat label="Platform (20%)" value={`$${platformRev.toFixed(0)}`} unit="/year" />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <button onClick={downloadReport} disabled={reportLoading}
              className="w-full bg-primary hover:bg-primary-dark text-black text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer btn-press disabled:opacity-50 transition-colors">
              <FileText size={13} />
              {reportLoading ? 'Generating PDF...' : 'Generate Verification PDF'}
            </button>
          </div>
        </div>

        {/* Projections & Info */}
        <div className="flex flex-col gap-6">
          {/* Revenue Breakdown */}
          <div className="bg-surface-card border border-white/[0.04] rounded-xl p-5">
            <h3 className="text-white text-[13px] font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" /> Revenue Projections
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Monthly Revenue', value: `$${(grossRev / 12).toFixed(0)}`, sub: 'Gross carbon credits' },
                { label: 'Quarterly Revenue', value: `$${(grossRev / 4).toFixed(0)}`, sub: '3-month projection' },
                { label: 'Annual Revenue', value: `$${grossRev.toFixed(0)}`, sub: '12-month projection', highlight: true },
                { label: 'Platform Share', value: `$${platformRev.toFixed(0)}`, sub: '20% commission' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0 animate-list-item" style={{ animationDelay: `${i * 60}ms` }}>
                  <div>
                    <p className="text-[11px] text-white font-semibold">{item.label}</p>
                    <p className="text-[9px] text-slate-500">{item.sub}</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${item.highlight ? 'text-primary' : 'text-white'}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Current Fleet Stats */}
          <div className="bg-surface-card border border-white/[0.04] rounded-xl p-5">
            <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
              <Truck size={14} className="text-primary" /> Live Fleet Context
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Active Trucks', value: `${summary?.active_trucks ?? 0}`, icon: <Truck size={12} /> },
                { label: 'CO2 Today', value: `${summary?.total_co2_today?.toFixed(1) ?? '0'} kg`, icon: <DollarSign size={12} /> },
                { label: 'Fleet Score', value: `${summary?.avg_green_score?.toFixed(0) ?? '0'}/100`, icon: <TrendingUp size={12} /> },
                { label: 'Avg Fuel Rate', value: `${trucks.length ? (trucks.reduce((s, t) => s + t.fuel_rate_lph, 0) / trucks.length).toFixed(1) : '0'} L/h`, icon: <Fuel size={12} /> },
              ].map((item, i) => (
                <div key={i} className="bg-black/20 rounded-lg p-3 animate-list-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-primary">{item.icon}</span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{item.label}</span>
                  </div>
                  <p className="text-white text-sm font-bold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Methodology */}
          <div className="bg-surface-card border border-white/[0.04] rounded-xl p-5">
            <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
              <Calculator size={14} className="text-accent-yellow" /> Methodology
            </h3>
            <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
              <p>Emission factor: <span className="text-white font-mono">2.68 kg CO2</span> per liter diesel</p>
              <p>Formula: <span className="text-white font-mono">trucks x L_saved x 2.68 x 365 / 1000</span></p>
              <p>Standard: <span className="text-primary font-semibold">IPCC / Indian MoRTH Guidelines</span></p>
              <div className="mt-3 p-3 bg-black/20 rounded-lg">
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Carbon Credit Standard</p>
                <p className="text-white text-[11px]">Verra VCS / Gold Standard methodology for transport sector emission reductions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
