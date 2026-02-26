/**
 * API service layer for CarbonRoute AI.
 * Communicates with the FastAPI backend.
 */
import type { FleetState, FleetSummary, RAGResponse, RevenueCalcResult, LedgerStats } from './types';

const API_BASE = 'http://localhost:8000';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  /** Get current fleet state (all trucks + alerts) */
  async getFleetState(): Promise<FleetState> {
    return fetchJSON<FleetState>(`${API_BASE}/fleet_state`);
  },

  /** Get fleet summary (KPIs) */
  async getFleetSummary(): Promise<FleetSummary> {
    return fetchJSON<FleetSummary>(`${API_BASE}/fleet_summary`);
  },

  /** Trigger a demo event */
  async triggerDemoEvent(eventType: string): Promise<void> {
    await fetchJSON(`${API_BASE}/demo_event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType }),
    });
  },

  /** Ask the RAG chat assistant */
  async queryRAG(question: string): Promise<RAGResponse> {
    return fetchJSON<RAGResponse>(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
  },

  /** Calculate carbon credit revenue */
  async calculateRevenue(numTrucks: number, litersSaved: number, pricePerTCO2: number): Promise<RevenueCalcResult> {
    return fetchJSON<RevenueCalcResult>(`${API_BASE}/calculate_revenue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        num_trucks: numTrucks,
        liters_saved_per_day: litersSaved,
        price_per_tco2: pricePerTCO2,
      }),
    });
  },

  /** Generate PDF verification report */
  async generateReport(numTrucks?: number, litersSaved?: number, pricePerTCO2?: number): Promise<Blob> {
    const body: Record<string, unknown> = {};
    if (numTrucks !== undefined) {
      body.num_trucks = numTrucks;
      body.liters_saved_per_day = litersSaved;
      body.price_per_tco2 = pricePerTCO2;
    }
    const response = await fetch(`${API_BASE}/generate_report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Report generation failed: ${response.status}`);
    }
    return response.blob();
  },

  /** Health check */
  async healthCheck(): Promise<boolean> {
    try {
      await fetchJSON(`${API_BASE}/health`);
      return true;
    } catch {
      return false;
    }
  },

  /** Get MRV ledger statistics */
  async getLedgerStats(): Promise<LedgerStats> {
    return fetchJSON<LedgerStats>(`${API_BASE}/ledger_stats`);
  },

  /** Export ledger as CSV (returns Blob) */
  async exportLedger(): Promise<Blob> {
    const response = await fetch(`${API_BASE}/export_ledger`);
    if (!response.ok) throw new Error(`Export failed: ${response.status}`);
    return response.blob();
  },
};
