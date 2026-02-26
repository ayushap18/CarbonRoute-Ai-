"""Pathway Streaming Pipeline for CarbonRoute AI.

This module implements the core real-time data processing pipeline using
Pathway's streaming engine for incremental computation of:
- CO₂ emissions per truck
- Rolling 5-minute aggregation windows
- Fleet-wide statistics

Pathway processes data incrementally - only recomputing what changes.
"""
import pathway as pw
import json
import time
from datetime import datetime, timezone


# --- Schema Definition ---
class TelemetrySchema(pw.Schema):
    truck_id: str
    lat: float
    lon: float
    speed_kmph: float
    fuel_rate_lph: float
    load_kg: float
    engine_status: str
    planned_route_id: str
    timestamp: str


# Constants
CO2_EMISSION_FACTOR = 2.68  # kg CO₂ per liter of diesel
TRUCK_CAPACITY = 3000.0


def build_pipeline(input_table: pw.Table) -> dict:
    """Build the Pathway streaming computation pipeline.

    Takes raw telemetry as input, produces:
    - CO₂ per record
    - Aggregated fleet metrics
    - Inefficiency flags

    Args:
        input_table: Pathway table with TelemetrySchema

    Returns:
        Dict of output tables
    """

    # --- Step 1: CO₂ Computation ---
    # Compute instantaneous CO₂ for each telemetry record
    # co2_kg = fuel_rate_lph × (1s / 3600) × 2.68
    enriched = input_table.select(
        truck_id=pw.this.truck_id,
        lat=pw.this.lat,
        lon=pw.this.lon,
        speed_kmph=pw.this.speed_kmph,
        fuel_rate_lph=pw.this.fuel_rate_lph,
        load_kg=pw.this.load_kg,
        engine_status=pw.this.engine_status,
        timestamp=pw.this.timestamp,
        # CO₂ per 1-second tick
        co2_kg=pw.this.fuel_rate_lph * (1.0 / 3600.0) * CO2_EMISSION_FACTOR,
        # Is the truck idling?
        is_idling=pw.cast(int, (pw.this.speed_kmph == 0.0) & (pw.this.engine_status == "ON")),
        # Load utilization percentage
        load_pct=pw.this.load_kg / TRUCK_CAPACITY,
    )

    # --- Step 2: Per-Truck Aggregation ---
    # Group by truck_id and compute running totals
    per_truck = enriched.groupby(pw.this.truck_id).reduce(
        truck_id=pw.this.truck_id,
        total_co2_kg=pw.reducers.sum(pw.this.co2_kg),
        avg_speed=pw.reducers.avg(pw.this.speed_kmph),
        avg_fuel_rate=pw.reducers.avg(pw.this.fuel_rate_lph),
        total_idle_ticks=pw.reducers.sum(pw.this.is_idling),
        avg_load_pct=pw.reducers.avg(pw.this.load_pct),
        record_count=pw.reducers.count(),
        latest_lat=pw.reducers.latest(pw.this.lat),
        latest_lon=pw.reducers.latest(pw.this.lon),
        latest_speed=pw.reducers.latest(pw.this.speed_kmph),
    )

    # --- Step 3: Fleet-Wide Summary ---
    fleet_summary = enriched.reduce(
        total_fleet_co2=pw.reducers.sum(pw.this.co2_kg),
        total_records=pw.reducers.count(),
        avg_fleet_speed=pw.reducers.avg(pw.this.speed_kmph),
        avg_fleet_fuel=pw.reducers.avg(pw.this.fuel_rate_lph),
        total_idle_events=pw.reducers.sum(pw.this.is_idling),
    )

    return {
        "enriched": enriched,
        "per_truck": per_truck,
        "fleet_summary": fleet_summary,
    }


def run_http_pipeline(host: str = "0.0.0.0", port: int = 8082):
    """Run the Pathway pipeline with HTTP input connector.

    This creates a streaming HTTP endpoint that the simulator or API
    can POST telemetry data to. Pathway processes it incrementally.
    """
    print(f"[Pathway] Starting streaming pipeline on {host}:{port}")

    # Create HTTP input connector
    input_table, response_writer = pw.io.http.rest_connector(
        host=host,
        port=port,
        schema=TelemetrySchema,
        autocommit_duration_ms=500,
        delete_completed_queries=True,
    )

    # Build the computation pipeline
    outputs = build_pipeline(input_table)

    # Output: Log enriched records
    pw.io.null.write(outputs["enriched"])

    # Output: Per-truck aggregations to jsonlines
    pw.io.jsonlines.write(outputs["per_truck"], "pathway_truck_output.jsonl")

    # Output: Fleet summary
    pw.io.jsonlines.write(outputs["fleet_summary"], "pathway_fleet_output.jsonl")

    print("[Pathway] Pipeline built. Running...")
    pw.run(monitoring_level=pw.MonitoringLevel.NONE)


def run_csv_pipeline(input_path: str = "telemetry_input.csv"):
    """Run the Pathway pipeline reading from a CSV file (batch mode for testing)."""
    print(f"[Pathway] Running batch pipeline from {input_path}")

    input_table = pw.io.csv.read(
        input_path,
        schema=TelemetrySchema,
        mode="static",
    )

    outputs = build_pipeline(input_table)

    pw.io.jsonlines.write(outputs["per_truck"], "pathway_truck_output.jsonl")
    pw.io.jsonlines.write(outputs["fleet_summary"], "pathway_fleet_output.jsonl")

    pw.run()
    print("[Pathway] Batch processing complete.")


if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "http"

    if mode == "http":
        run_http_pipeline()
    elif mode == "csv":
        input_file = sys.argv[2] if len(sys.argv) > 2 else "telemetry_input.csv"
        run_csv_pipeline(input_file)
    else:
        print(f"Unknown mode: {mode}. Use 'http' or 'csv'.")
