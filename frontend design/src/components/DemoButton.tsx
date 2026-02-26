import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function DemoButton({ label, icon, active, onClick, variant }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void; variant?: string;
}) {
  const cls = variant === 'reset'
    ? 'border-accent-red/20 bg-accent-red/10 hover:bg-accent-red/20 text-accent-red'
    : active ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/[0.06] bg-surface-dark hover:bg-surface-dark/80 text-slate-400 hover:text-white';
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-1 text-[10px] font-semibold py-1.5 rounded-lg border transition-all cursor-pointer btn-press ${cls}`}>
      {active ? <CheckCircle2 size={10} /> : icon}{label}
    </button>
  );
}
