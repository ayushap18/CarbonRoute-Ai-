import React from 'react';
import {
  Leaf, Wifi, WifiOff, LayoutDashboard, BarChart3, ShieldCheck,
  PiggyBank, Bot, AlertTriangle, Zap, Route, Pause, RotateCcw
} from 'lucide-react';
import { useFleet } from '../context/FleetContext';
import DemoButton from './DemoButton';
import type { PageId } from '../types';

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
  { id: 'ledger', label: 'MRV Ledger', icon: <ShieldCheck size={15} /> },
  { id: 'revenue', label: 'Revenue', icon: <PiggyBank size={15} /> },
  { id: 'chat', label: 'AI Chat', icon: <Bot size={15} /> },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={15} /> },
];

export default function Sidebar({ currentPage, onNavigate }: {
  currentPage: PageId; onNavigate: (page: PageId) => void;
}) {
  const { connected, trucks, summary, alerts, triggerDemo, activeDemo } = useFleet();

  return (
    <aside className="w-[260px] bg-surface-darker flex flex-col h-screen shrink-0 z-20 border-r border-white/[0.04]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-white text-[15px] font-bold leading-tight tracking-tight">CarbonRoute</h1>
            <p className="text-primary text-[10px] font-semibold tracking-widest uppercase">AI Fleet Engine</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="mx-5 mb-4 px-3 py-2 rounded-lg bg-surface-dark/60 border border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary animate-soft-pulse' : 'bg-accent-red'}`} />
          {connected ? <Wifi size={11} className="text-primary" /> : <WifiOff size={11} className="text-accent-red" />}
          <span className="text-xs text-slate-400">{connected ? 'Live Telemetry' : 'Disconnected'}</span>
          {connected && <span className="ml-auto text-[10px] text-primary font-mono">{trucks.length}/6</span>}
        </div>
      </div>

      {/* CO2 Hero Counter */}
      <div className="mx-5 mb-5 p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
        <p className="text-[10px] text-primary/70 font-bold uppercase tracking-widest mb-1">Fleet CO2 Today</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-white tabular-nums tracking-tight">{summary?.total_co2_today?.toFixed(1) ?? '0.0'}</span>
          <span className="text-sm text-primary/60 font-semibold">kg</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-black/30 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ((summary?.total_co2_today ?? 0) / 500) * 100)}%` }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-1">{summary?.active_trucks ?? 0} active trucks</p>
      </div>

      {/* Navigation */}
      <div className="mx-3 mb-4">
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2 px-2">Navigation</p>
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = currentPage === item.id;
            const alertCount = item.id === 'alerts' ? alerts.length : 0;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer btn-press ${
                  isActive
                    ? 'bg-primary/10 text-primary nav-active'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-surface-dark/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {alertCount > 0 && (
                  <span className="ml-auto text-[9px] bg-accent-red/20 text-accent-red px-1.5 py-0.5 rounded-full font-bold">{alertCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Demo Controls */}
      <div className="mx-5 mb-4">
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Demo Controls</p>
        <div className="grid grid-cols-2 gap-1.5">
          <DemoButton label="Traffic Jam" icon={<Zap size={11} />} active={!!activeDemo['traffic_jam']} onClick={() => triggerDemo('traffic_jam')} />
          <DemoButton label="Deviate T3" icon={<Route size={11} />} active={!!activeDemo['deviation_t3']} onClick={() => triggerDemo('deviation_t3')} />
          <DemoButton label="Idle T4" icon={<Pause size={11} />} active={!!activeDemo['idle_t4']} onClick={() => triggerDemo('idle_t4')} />
          <DemoButton label="Reset All" icon={<RotateCcw size={11} />} active={false} onClick={() => triggerDemo('reset')} variant="reset" />
        </div>
      </div>

      <div className="flex-1" />

      {/* Recent Alerts */}
      <div className="px-5 py-4 border-t border-white/[0.04] bg-surface-dark/40">
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Active Alerts ({alerts.length})</p>
        <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
          {alerts.slice(0, 4).map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] py-1 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.severity === 'HIGH' ? 'bg-accent-red' : 'bg-accent-yellow'}`} />
              <span className="text-slate-400 truncate">{a.truck_id} - {a.alert_type.replace('_', ' ')}</span>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-[11px] text-slate-600">No active alerts</p>}
        </div>
      </div>
    </aside>
  );
}
