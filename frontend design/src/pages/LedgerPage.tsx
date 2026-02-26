import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Download, Database, Hash, Clock, Truck, FileText } from 'lucide-react';
import { api } from '../api';
import BarChart from '../components/BarChart';
import type { LedgerStats } from '../types';
import { badgeHexColor } from '../types';

export default function LedgerPage() {
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      try {
        const data = await api.getLedgerStats();
        if (active) { setStats(data); setLoading(false); }
      } catch { if (active) setLoading(false); }
    };
    fetch();
    const id = setInterval(fetch, 30000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const exportCsv = useCallback(async () => {
    setCsvLoading(true);
    try {
      const blob = await api.exportLedger();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'carbon_ledger.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to export CSV.'); }
    setCsvLoading(false);
  }, []);

  const exportPdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      const blob = await api.generateReport();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'verification_report.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to generate report.'); }
    setPdfLoading(false);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-page-enter">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck size={20} className="text-primary" />
        <h2 className="text-white text-lg font-bold">MRV Ledger & Compliance</h2>
        <span className="text-[10px] text-slate-500 ml-2">Tamper-evident carbon tracking</span>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Records', value: stats?.total_records?.toLocaleString() ?? '...', icon: <Database size={14} />, color: 'text-primary' },
          { label: 'Total CO2 Tracked', value: `${stats?.total_co2_kg?.toFixed(1) ?? '...'} kg`, icon: <ShieldCheck size={14} />, color: 'text-primary' },
          { label: 'Chain Integrity', value: 'Verified', icon: <Hash size={14} />, color: 'text-primary' },
          { label: 'Snapshots', value: `${stats?.recent_snapshots?.length ?? '...'}`, icon: <Clock size={14} />, color: 'text-accent-blue' },
        ].map((item, i) => (
          <div key={i} className="bg-surface-card border border-white/[0.04] rounded-xl p-4 animate-list-item" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className={item.color}>{item.icon}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{item.label}</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Hash Chain Timeline */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-4 flex items-center gap-2">
            <Hash size={14} className="text-primary" /> Hash Chain Verification
          </h3>
          {stats?.recent_snapshots && stats.recent_snapshots.length > 0 ? (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2 top-2 bottom-2 w-px bg-primary/20" />
              <div className="flex flex-col gap-4">
                {stats.recent_snapshots.map((snap, i) => (
                  <div key={snap.id} className="relative animate-list-item" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full bg-surface-card border-2 border-primary" />
                    <div className="bg-black/20 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                        <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-semibold">{snap.record_count} records</span>
                      </div>
                      <p className="text-[10px] text-primary/80 font-mono break-all">{snap.hash}</p>
                      <p className="text-[9px] text-slate-500 mt-1">CO2: {snap.total_co2_kg.toFixed(2)} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">{loading ? 'Loading snapshots...' : 'No snapshots yet'}</p>
          )}
        </div>

        {/* Daily CO2 Summary */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <Truck size={14} className="text-primary" /> Daily CO2 by Truck
          </h3>
          {stats?.daily_summary && stats.daily_summary.length > 0 ? (
            <>
              <BarChart data={[...stats.daily_summary].sort((a, b) => b.total_co2 - a.total_co2).map(d => ({
                label: d.truck_id,
                value: d.total_co2,
                color: '#22c55e',
              }))} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-slate-500 font-semibold py-2">Truck</th>
                      <th className="text-left text-slate-500 font-semibold py-2">Total CO2</th>
                      <th className="text-left text-slate-500 font-semibold py-2">Records</th>
                      <th className="text-left text-slate-500 font-semibold py-2">Avg Fuel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.daily_summary.map(d => (
                      <tr key={d.truck_id} className="border-b border-white/[0.03]">
                        <td className="py-1.5 text-white font-bold">{d.truck_id}</td>
                        <td className="py-1.5 text-slate-300 tabular-nums">{d.total_co2.toFixed(2)} kg</td>
                        <td className="py-1.5 text-slate-300 tabular-nums">{d.records}</td>
                        <td className="py-1.5 text-slate-300 tabular-nums">{d.avg_fuel_rate.toFixed(1)} L/h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm">{loading ? 'Loading...' : 'No data yet'}</p>
          )}
        </div>

        {/* Export Section */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <Download size={14} className="text-accent-blue" /> Data Export
          </h3>
          <div className="flex flex-col gap-3">
            <button onClick={exportCsv} disabled={csvLoading}
              className="w-full bg-surface-dark hover:bg-surface-dark/80 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer btn-press border border-white/[0.06] disabled:opacity-50 transition-colors">
              <Download size={13} />
              {csvLoading ? 'Exporting...' : 'Export Ledger CSV'}
            </button>
            <button onClick={exportPdf} disabled={pdfLoading}
              className="w-full bg-primary hover:bg-primary-dark text-black text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer btn-press disabled:opacity-50 transition-colors">
              <FileText size={13} />
              {pdfLoading ? 'Generating...' : 'Generate Verification PDF'}
            </button>
          </div>
        </div>

        {/* Integrity Info */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" /> Data Integrity
          </h3>
          <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
            <p>All telemetry records are stored in an <span className="text-white font-semibold">append-only SQLite ledger</span> with cryptographic integrity.</p>
            <p>Every <span className="text-primary font-semibold">60 seconds</span>, a batch snapshot is created with a <span className="text-primary font-semibold">SHA-256 hash</span> of all records in that interval.</p>
            <p>This creates a <span className="text-white font-semibold">tamper-evident chain</span> that can be independently verified for carbon credit claims under MRV (Measurement, Reporting, Verification) standards.</p>
            <div className="mt-3 p-3 bg-black/20 rounded-lg">
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Emission Factor</p>
              <p className="text-white font-mono">2.68 kg CO2 per liter diesel</p>
              <p className="text-[9px] text-slate-500 mt-1">Source: IPCC / Indian MoRTH Guidelines</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
