import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api } from '../api';
import type { FleetState, FleetSummary, TruckState, Alert } from '../types';

const POLL_INTERVAL = 1200;

interface FleetContextValue {
  fleetState: FleetState | null;
  summary: FleetSummary | null;
  connected: boolean;
  trucks: TruckState[];
  alerts: Alert[];
  sortedTrucks: TruckState[];
  selectedTruck: string | null;
  setSelectedTruck: (id: string | null) => void;
  triggerDemo: (eventType: string) => void;
  activeDemo: Record<string, boolean>;
}

const FleetContext = createContext<FleetContextValue | null>(null);

export function useFleet(): FleetContextValue {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet must be used within FleetProvider');
  return ctx;
}

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [fleetState, setFleetState] = useState<FleetState | null>(null);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [activeDemo, setActiveDemo] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const [state, sum] = await Promise.all([api.getFleetState(), api.getFleetSummary()]);
        if (active) { setFleetState(state); setSummary(sum); setConnected(true); }
      } catch { if (active) setConnected(false); }
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => { active = false; clearInterval(id); };
  }, []);

  const triggerDemo = useCallback(async (eventType: string) => {
    setActiveDemo(prev => ({ ...prev, [eventType]: true }));
    try { await api.triggerDemoEvent(eventType); } catch {}
    if (eventType === 'reset') setActiveDemo({});
    else setTimeout(() => setActiveDemo(prev => ({ ...prev, [eventType]: false })), 2000);
  }, []);

  const trucks = fleetState ? Object.values(fleetState.trucks) : [];
  const alerts = fleetState?.alerts ?? [];
  const sortedTrucks = [...trucks].sort((a, b) => {
    const ord: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
    return (ord[a.green_badge] ?? 2) - (ord[b.green_badge] ?? 2);
  });

  return (
    <FleetContext.Provider value={{
      fleetState, summary, connected, trucks, alerts, sortedTrucks,
      selectedTruck, setSelectedTruck, triggerDemo, activeDemo,
    }}>
      {children}
    </FleetContext.Provider>
  );
}
