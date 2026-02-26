/**
 * TypeScript types for CarbonRoute AI frontend.
 */

export interface TruckState {
  truck_id: string;
  lat: number;
  lon: number;
  speed_kmph: number;
  fuel_rate_lph: number;
  load_kg: number;
  engine_status: 'ON' | 'OFF';
  co2_rate_kgph: number;
  co2_today_kg: number;
  green_score: number;
  green_badge: 'GREEN' | 'YELLOW' | 'RED';
  active_alert: string | null;
  trail: number[][];  // [[lon, lat], ...]
  trail_colors: number[][]; // [[R,G,B,A], ...]
  last_timestamp: string;
  idle_seconds: number;
  avg_fuel_rate_5min: number;
  avg_speed_5min: number;
  total_distance_km: number;
  load_capacity_kg: number;
  eta_minutes: number;
  location_name: string;
}

export interface Alert {
  truck_id: string;
  alert_type: 'IDLING' | 'HIGH_FUEL' | 'DEVIATION' | 'LOW_LOAD';
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  resolved: boolean;
}

export interface FleetState {
  trucks: Record<string, TruckState>;
  alerts: Alert[];
  timestamp: string;
}

export interface FleetSummary {
  total_co2_today: number;
  active_alerts: number;
  best_truck_id: string;
  best_truck_score: number;
  worst_truck_id: string;
  worst_truck_score: number;
  avg_green_score: number;
  total_trucks: number;
  active_trucks: number;
}

export interface RAGResponse {
  answer: string;
  citations: string[];
}

export interface RevenueCalcResult {
  annual_tonnes_saved: number;
  gross_annual_revenue: number;
  platform_revenue: number;
  daily_co2_saved_kg: number;
}

// Page navigation
export type PageId = 'dashboard' | 'analytics' | 'ledger' | 'revenue' | 'chat' | 'alerts';

// Ledger stats from GET /ledger_stats
export interface LedgerStats {
  total_records: number;
  total_co2_kg: number;
  recent_snapshots: SnapshotRecord[];
  daily_summary: DailySummary[];
}

export interface SnapshotRecord {
  id: number;
  timestamp: string;
  record_count: number;
  hash: string;
  total_co2_kg: number;
}

export interface DailySummary {
  truck_id: string;
  total_co2: number;
  records: number;
  avg_fuel_rate: number;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  citations?: string[];
}

// Utility functions
export function badgeHexColor(b: string): string {
  return b === 'GREEN' ? '#22c55e' : b === 'YELLOW' ? '#eab308' : '#ef4444';
}
export function badgeTextColor(b: string): string {
  return b === 'GREEN' ? 'text-primary' : b === 'YELLOW' ? 'text-accent-yellow' : 'text-accent-red';
}
