"""FastAPI Main Application for CarbonRoute AI.

Central REST API that connects all components:
- Telemetry ingestion
- Fleet state management
- RAG chat interface
- PDF report generation
- Demo controls
"""
import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

from models import (
    TelemetryPayload, DemoEvent, RAGQuery, RAGResponse,
    RevenueCalcRequest, RevenueCalcResponse, FleetSummary,
)
from state import fleet_store
from compute import process_telemetry, CO2_EMISSION_FACTOR
from ledger import ledger
from rag_provider import rag_provider
from pdf_report import generate_verification_pdf

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    print("[API] CarbonRoute AI Backend starting...")
    print("[API] Endpoints available at http://localhost:8000")
    print("[API] Docs at http://localhost:8000/docs")
    yield
    # Flush ledger on shutdown
    ledger.force_flush()
    print("[API] Backend shut down. Ledger flushed.")


app = FastAPI(
    title="CarbonRoute AI - Smart Green Logistics",
    description="Real-time AI-powered fleet carbon emission tracking and carbon credit verification",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ───────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "CarbonRoute AI",
        "status": "running",
        "version": "1.0.0",
        "endpoints": ["/ingest", "/fleet_state", "/fleet_summary", "/query", "/generate_report"],
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "ledger_records": ledger.get_record_count()}


# ─── Telemetry Ingestion ───────────────────────────────────────────────

@app.post("/ingest")
async def ingest_telemetry(payload: TelemetryPayload):
    """Receive telemetry from simulator and process it.

    This is the main data entry point. Each telemetry record triggers:
    1. CO₂ computation
    2. Inefficiency detection
    3. Green Score update
    4. Ledger recording
    """
    try:
        # Process through compute engine
        new_state = process_telemetry(payload)

        # Record in MRV ledger
        ledger.append_record({
            "timestamp": payload.timestamp,
            "truck_id": payload.truck_id,
            "lat": payload.lat,
            "lon": payload.lon,
            "speed": payload.speed_kmph,
            "fuel_rate": payload.fuel_rate_lph,
            "load_kg": payload.load_kg,
            "co2_kg": new_state.co2_rate_kgph / 3600.0,  # per-second CO₂
        })

        return {"status": "ok", "truck_id": payload.truck_id, "green_score": new_state.green_score}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Fleet State ───────────────────────────────────────────────────────

@app.get("/fleet_state")
async def get_fleet_state():
    """Get current state of all trucks including positions, metrics, and trails."""
    trucks = fleet_store.get_all_trucks()
    alerts = fleet_store.get_all_alerts()

    return {
        "trucks": {tid: t.model_dump() for tid, t in trucks.items()},
        "alerts": [a.model_dump() for a in alerts],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/fleet_summary")
async def get_fleet_summary():
    """Get fleet-wide summary: total CO₂, alerts, best/worst truck."""
    summary = fleet_store.get_fleet_summary()
    return summary.model_dump()


# ─── Demo Controls ─────────────────────────────────────────────────────

@app.post("/demo_event")
async def trigger_demo_event(event: DemoEvent):
    """Trigger a demo scenario event."""
    event_type = event.event_type.lower()

    if event_type == "traffic_jam":
        fleet_store.set_demo_flag("traffic_jam", True)
        return {"status": "ok", "event": "traffic_jam", "message": "Traffic jam activated - all trucks slowing down"}

    elif event_type == "deviation_t3":
        fleet_store.set_demo_flag("deviation_t3", True)
        return {"status": "ok", "event": "deviation_t3", "message": "T3 route deviation activated"}

    elif event_type == "idle_t4":
        fleet_store.set_demo_flag("idle_t4", True)
        return {"status": "ok", "event": "idle_t4", "message": "T4 idling activated"}

    elif event_type == "reset":
        fleet_store.reset_demo()
        return {"status": "ok", "event": "reset", "message": "All demo events reset"}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown event type: {event_type}")


@app.get("/demo_flags")
async def get_demo_flags():
    """Get current demo flags (used by simulator)."""
    return fleet_store.get_demo_flags()


# ─── RAG Chat ──────────────────────────────────────────────────────────

@app.post("/query", response_model=RAGResponse)
async def rag_query(query: RAGQuery):
    """Ask the AI fleet analyst a question powered by RAG."""
    try:
        trucks = fleet_store.get_all_trucks()
        alerts = fleet_store.get_all_alerts()
        snapshots = ledger.get_recent_snapshots(5)

        fleet_state = {
            "trucks": {tid: t.model_dump() for tid, t in trucks.items()},
        }
        alerts_list = [a.model_dump() for a in alerts]

        answer, citations = await rag_provider.query(
            query.question, fleet_state, alerts_list, snapshots
        )

        return RAGResponse(answer=answer, citations=citations)
    except Exception as e:
        return RAGResponse(answer=f"Error processing query: {str(e)}", citations=[])


# ─── Report Generation ─────────────────────────────────────────────────

@app.post("/generate_report")
async def generate_report(revenue: Optional[RevenueCalcRequest] = None):
    """Generate a PDF verification report."""
    try:
        summary = fleet_store.get_fleet_summary()
        recent_records = ledger.get_recent_records(10)
        snapshots = ledger.get_recent_snapshots(5)

        revenue_data = None
        if revenue:
            annual_tonnes, gross_rev, platform_rev, daily_co2 = calculate_revenue(
                revenue.num_trucks, revenue.liters_saved_per_day, revenue.price_per_tco2
            )
            revenue_data = {
                "num_trucks": revenue.num_trucks,
                "liters_saved_per_day": revenue.liters_saved_per_day,
                "price_per_tco2": revenue.price_per_tco2,
                "annual_tonnes_saved": annual_tonnes,
                "gross_annual_revenue": gross_rev,
                "platform_revenue": platform_rev,
            }

        pdf_bytes = generate_verification_pdf(
            fleet_summary=summary.model_dump(),
            ledger_records=recent_records,
            snapshot_hashes=snapshots,
            revenue_data=revenue_data,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=verification_report.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


# ─── Revenue Calculator ───────────────────────────────────────────────

def calculate_revenue(num_trucks: int, liters_saved_per_day: float, price_per_tco2: float):
    """Calculate carbon credit revenue projections."""
    daily_co2_saved_kg = num_trucks * liters_saved_per_day * CO2_EMISSION_FACTOR
    annual_co2_saved_kg = daily_co2_saved_kg * 365
    annual_tonnes_saved = annual_co2_saved_kg / 1000.0
    gross_revenue = annual_tonnes_saved * price_per_tco2
    platform_revenue = gross_revenue * 0.20
    return annual_tonnes_saved, gross_revenue, platform_revenue, daily_co2_saved_kg


@app.post("/calculate_revenue", response_model=RevenueCalcResponse)
async def calc_revenue(req: RevenueCalcRequest):
    """Calculate projected carbon credit revenue."""
    annual_tonnes, gross_rev, platform_rev, daily_co2 = calculate_revenue(
        req.num_trucks, req.liters_saved_per_day, req.price_per_tco2
    )
    return RevenueCalcResponse(
        annual_tonnes_saved=round(annual_tonnes, 1),
        gross_annual_revenue=round(gross_rev, 0),
        platform_revenue=round(platform_rev, 0),
        daily_co2_saved_kg=round(daily_co2, 1),
    )


# ─── Ledger Export ────────────────────────────────────────────────────

@app.get("/export_ledger")
async def export_ledger():
    """Export the MRV ledger as CSV."""
    csv_data = ledger.export_csv()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=carbon_ledger.csv"},
    )


@app.get("/ledger_stats")
async def ledger_stats():
    """Get ledger statistics."""
    return {
        "total_records": ledger.get_record_count(),
        "total_co2_kg": round(ledger.get_total_co2(), 2),
        "recent_snapshots": ledger.get_recent_snapshots(5),
        "daily_summary": ledger.get_daily_summary(),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
