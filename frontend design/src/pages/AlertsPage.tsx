import React from 'react';
import { AlertTriangle, ShieldAlert, Clock, Truck, Fuel, Route, Pause, Weight, Info } from 'lucide-react';
import { useFleet } from '../context/FleetContext';

const ALERT_RULES = [
  { type: 'IDLING', icon: <Pause size={13} />, color: 'text-accent-red', bg: 'bg-accent-red/10', threshold: '> 5 minutes with engine ON', penalty: 'Up to 30 points (3 pts/min)', severity: 'HIGH' },
  { type: 'HIGH_FUEL', icon: <Fuel size={13} />, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', threshold: '> 25% above fleet average', penalty: 'Up to 30 points (0.6 pts/%)', severity: 'MEDIUM' },
  { type: 'DEVIATION', icon: <Route size={13} />, color: 'text-accent-red', bg: 'bg-accent-red/10', threshold: '> 500m from planned route', penalty: 'Up to 20 points (10 pts/km)', severity: 'HIGH' },
  { type: 'LOW_LOAD', icon: <Weight size={13} />, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', threshold: '< 30% load capacity', penalty: 'Up to 20 points', severity: 'LOW' },
];

export default function AlertsPage() {
  const { alerts, trucks } = useFleet();

  const alertsByType: Record<string, number> = {};
  const alertsBySeverity: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  alerts.forEach(a => {
    alertsByType[a.alert_type] = (alertsByType[a.alert_type] ?? 0) + 1;
    alertsBySeverity[a.severity] = (alertsBySeverity[a.severity] ?? 0) + 1;
  });

  const trucksWithAlerts = trucks.filter(t => t.active_alert);

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-page-enter">
      <div className="flex items-center gap-2 mb-6">
        <ShieldAlert size={20} className="text-accent-red" />
        <h2 className="text-white text-lg font-bold">Fleet Alerts</h2>
        <span className="text-[10px] text-slate-500 ml-2">{alerts.length} active alerts</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Alerts', value: alerts.length, color: 'text-accent-red', icon: <AlertTriangle size={14} /> },
          { label: 'High Severity', value: alertsBySeverity.HIGH, color: 'text-accent-red', icon: <ShieldAlert size={14} /> },
          { label: 'Medium Severity', value: alertsBySeverity.MEDIUM, color: 'text-accent-yellow', icon: <AlertTriangle size={14} /> },
          { label: 'Trucks Affected', value: trucksWithAlerts.length, color: 'text-accent-blue', icon: <Truck size={14} /> },
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
        {/* Live Alert Feed */}
        <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
          <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-accent-red" /> Live Alert Feed
          </h3>
          {alerts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {alerts.map((a, i) => (
                <div key={i} className="bg-black/20 rounded-lg p-3 border-l-2 animate-list-item" style={{
                  animationDelay: `${i * 50}ms`,
                  borderLeftColor: a.severity === 'HIGH' ? '#ef4444' : a.severity === 'MEDIUM' ? '#eab308' : '#3b82f6',
                }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${a.severity === 'HIGH' ? 'bg-accent-red' : a.severity === 'MEDIUM' ? 'bg-accent-yellow' : 'bg-accent-blue'}`} />
                      <span className="text-white text-[12px] font-bold">{a.truck_id}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                        a.severity === 'HIGH' ? 'bg-accent-red/15 text-accent-red' : a.severity === 'MEDIUM' ? 'bg-accent-yellow/15 text-accent-yellow' : 'bg-accent-blue/15 text-accent-blue'
                      }`}>{a.severity}</span>
                    </div>
                    <span className="text-[9px] text-slate-500">{a.alert_type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{a.message}</p>
                  <p className="text-[9px] text-slate-600 mt-1">{new Date(a.timestamp).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle size={32} className="mx-auto mb-3 text-slate-700" />
              <p className="text-slate-500 text-sm">No active alerts</p>
              <p className="text-slate-600 text-[10px] mt-1">All trucks operating within normal parameters</p>
            </div>
          )}
        </div>

        {/* Alerts by Type */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
            <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
              <Clock size={14} className="text-accent-blue" /> Alerts by Type
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { type: 'IDLING', icon: <Pause size={12} />, color: 'bg-accent-red' },
                { type: 'HIGH_FUEL', icon: <Fuel size={12} />, color: 'bg-accent-yellow' },
                { type: 'DEVIATION', icon: <Route size={12} />, color: 'bg-accent-red' },
                { type: 'LOW_LOAD', icon: <Weight size={12} />, color: 'bg-accent-blue' },
              ].map((item, i) => {
                const count = alertsByType[item.type] ?? 0;
                const maxCount = Math.max(...Object.values(alertsByType), 1);
                return (
                  <div key={i} className="animate-list-item" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{item.icon}</span>
                        <span className="text-[11px] text-white font-semibold">{item.type.replace('_', ' ')}</span>
                      </div>
                      <span className="text-[11px] text-white font-bold tabular-nums">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/20 overflow-hidden">
                      <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${(count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Affected Trucks */}
          <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
            <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
              <Truck size={14} className="text-primary" /> Affected Trucks
            </h3>
            {trucksWithAlerts.length > 0 ? (
              <div className="flex flex-col gap-2">
                {trucksWithAlerts.map((t, i) => (
                  <div key={t.truck_id} className="flex items-center gap-3 bg-black/20 rounded-lg p-2.5 animate-list-item" style={{ animationDelay: `${i * 50}ms` }}>
                    <span className={`w-2.5 h-2.5 rounded-full ${t.green_badge === 'GREEN' ? 'bg-primary' : t.green_badge === 'YELLOW' ? 'bg-accent-yellow' : 'bg-accent-red'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white font-bold">{t.truck_id}</p>
                      <p className="text-[9px] text-accent-red truncate">{t.active_alert}</p>
                    </div>
                    <span className="text-[11px] text-slate-500 font-bold tabular-nums">Score: {t.green_score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-[11px] py-4 text-center">No trucks currently affected</p>
            )}
          </div>

          {/* Alert Rules */}
          <div className="bg-surface-card border border-white/[0.04] rounded-xl p-4">
            <h3 className="text-white text-[13px] font-bold mb-3 flex items-center gap-2">
              <Info size={14} className="text-slate-400" /> Alert Rules Reference
            </h3>
            <div className="flex flex-col gap-2.5">
              {ALERT_RULES.map((rule, i) => (
                <div key={i} className={`${rule.bg} rounded-lg p-3 animate-list-item`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={rule.color}>{rule.icon}</span>
                    <span className={`text-[11px] font-bold ${rule.color}`}>{rule.type.replace('_', ' ')}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-semibold ml-auto ${
                      rule.severity === 'HIGH' ? 'bg-accent-red/20 text-accent-red' : rule.severity === 'MEDIUM' ? 'bg-accent-yellow/20 text-accent-yellow' : 'bg-accent-blue/20 text-accent-blue'
                    }`}>{rule.severity}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Trigger: <span className="text-white">{rule.threshold}</span></p>
                  <p className="text-[10px] text-slate-400">Score penalty: <span className="text-white">{rule.penalty}</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
