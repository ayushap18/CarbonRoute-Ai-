import React from 'react';
import { Truck, Cloud, Navigation, Fuel, Weight, AlertTriangle, ChevronRight } from 'lucide-react';
import type { TruckState } from '../types';
import { badgeHexColor } from '../types';

export default function TwinCard({ truck, selected, onClick, delay = 0 }: {
  truck: TruckState; selected: boolean; onClick: () => void; delay?: number;
}) {
  const color = badgeHexColor(truck.green_badge);
  const badgeCls = truck.green_badge === 'GREEN' ? 'text-primary' : truck.green_badge === 'YELLOW' ? 'text-accent-yellow' : 'text-accent-red';
  const loadPct = ((truck.load_kg / truck.load_capacity_kg) * 100).toFixed(0);

  return (
    <div onClick={onClick} className={`rounded-xl p-3 border cursor-pointer transition-all animate-fade-in card-glow ${
      selected ? 'bg-surface-dark border-primary/30 shadow-[0_0_12px_rgba(34,197,94,0.08)]'
      : truck.active_alert ? 'bg-surface-card border-accent-red/20 hover:border-accent-red/40'
      : 'bg-surface-card border-white/[0.04] hover:border-white/[0.08]'
    }`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2 mb-2">
        <TruckBadge badge={truck.green_badge} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-white text-[13px] font-bold">Truck {truck.truck_id}</p>
            <span className={`text-[12px] font-bold ${badgeCls}`}>{truck.green_score}</span>
          </div>
          <p className="text-[9px] text-slate-500 truncate">{truck.location_name}</p>
        </div>
        <ChevronRight size={13} className={`text-slate-600 transition-transform ${selected ? 'rotate-90 text-primary' : ''}`} />
      </div>
      <div className="flex gap-1">
        <MiniStat icon={<Cloud size={9} />} value={`${truck.co2_rate_kgph.toFixed(1)}`} unit="kg/h" alert={truck.co2_rate_kgph > 10} />
        <MiniStat icon={<Navigation size={9} />} value={`${truck.speed_kmph.toFixed(0)}`} unit="km/h" />
        <MiniStat icon={<Fuel size={9} />} value={`${truck.fuel_rate_lph.toFixed(1)}`} unit="L/h" />
        <MiniStat icon={<Weight size={9} />} value={`${loadPct}`} unit="%" alert={Number(loadPct) < 30} />
      </div>
      <div className="mt-2 h-1 rounded-full bg-black/30 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${truck.green_score}%`, backgroundColor: color }} />
      </div>
      {truck.active_alert && (
        <div className="mt-1.5 text-[9px] text-accent-red bg-accent-red/8 px-2 py-0.5 rounded flex items-center gap-1">
          <AlertTriangle size={9} /> {truck.active_alert.split(' - ')[0]}
        </div>
      )}
    </div>
  );
}

export function TruckBadge({ badge }: { badge: string }) {
  const cls = badge === 'GREEN' ? 'bg-primary/15 text-primary' : badge === 'YELLOW' ? 'bg-accent-yellow/15 text-accent-yellow' : 'bg-accent-red/15 text-accent-red';
  return <div className={`w-7 h-7 rounded-lg ${cls} flex items-center justify-center`}><Truck size={13} /></div>;
}

export function MiniStat({ icon, value, unit, alert: isAlert }: { icon: React.ReactNode; value: string; unit: string; alert?: boolean; }) {
  return (
    <div className={`flex-1 flex items-center gap-0.5 bg-black/20 rounded px-1.5 py-0.5 ${isAlert ? 'text-accent-red' : 'text-slate-400'}`}>
      {icon}
      <span className={`text-[10px] font-bold ${isAlert ? 'text-accent-red' : 'text-white'}`}>{value}</span>
      <span className="text-[7px]">{unit}</span>
    </div>
  );
}

export function StatBox({ label, value, color = 'text-white' }: { label: string; value: string; color?: string; }) {
  return (
    <div className="bg-black/20 rounded-lg px-2 py-1.5">
      <p className="text-[8px] text-slate-500 uppercase">{label}</p>
      <p className={`text-[13px] font-bold ${color}`}>{value}</p>
    </div>
  );
}
