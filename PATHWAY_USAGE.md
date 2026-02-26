# Pathway Framework Usage in CarbonRoute AI

## What is Pathway?

[Pathway](https://pathway.com) is a Python-based real-time data processing framework designed for streaming and incremental computation. Unlike traditional batch processing, Pathway recomputes only what changes — making it ideal for live telemetry, IoT, and time-series data pipelines.

**Version used:** `pathway==0.29.1`

---

## Why Pathway for CarbonRoute AI?

CarbonRoute AI processes **live telemetry from 6 trucks at 1-second intervals** (6 records/second, 21,600 records/hour). The core requirements are:

| Requirement | Why Pathway Fits |
|---|---|
| Real-time CO₂ computation per truck | Pathway's incremental `select()` recomputes only changed rows |
| Rolling 5-minute aggregation windows | `groupby().reduce()` with streaming reducers |
| Fleet-wide summary statistics | Single `reduce()` across entire table |
| Low-latency data ingestion | Built-in `pw.io.http.rest_connector` for HTTP streaming input |
| Structured output | `pw.io.jsonlines.write` for downstream consumption |

---

## Pathway APIs and Features Used

### 1. Schema Definition (`pw.Schema`)

**File:** `backend/pathway_pipeline.py`, Line 18-28

```python
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
```

Defines the shape of incoming telemetry records. Pathway uses this schema to type-check and validate data at ingestion time.

---

### 2. Table Transformations (`pw.Table.select`, `pw.this`)

**File:** `backend/pathway_pipeline.py`, Lines 53-68

```python
enriched = input_table.select(
    truck_id=pw.this.truck_id,
    co2_kg=pw.this.fuel_rate_lph * (1.0 / 3600.0) * CO2_EMISSION_FACTOR,
    is_idling=pw.cast(int, (pw.this.speed_kmph == 0.0) & (pw.this.engine_status == "ON")),
    load_pct=pw.this.load_kg / TRUCK_CAPACITY,
)
```

**Pathway features used:**
- `pw.this` — Column reference expressions for the current table
- `pw.Table.select()` — Creates a new table with computed columns
- `pw.cast()` — Type casting within expressions (bool → int for summation)
- Arithmetic expressions on columns (`fuel_rate_lph * (1.0 / 3600.0) * 2.68`)
- Boolean logic on columns (`speed_kmph == 0.0` & `engine_status == "ON"`)

---

### 3. Grouped Aggregation (`groupby`, `reduce`, `pw.reducers`)

**File:** `backend/pathway_pipeline.py`, Lines 72-83

```python
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
```

**Pathway Reducers used:**
| Reducer | Purpose in CarbonRoute |
|---|---|
| `pw.reducers.sum()` | Total CO₂ emitted per truck, total idle ticks |
| `pw.reducers.avg()` | Average speed, fuel rate, load utilization |
| `pw.reducers.count()` | Total telemetry records per truck |
| `pw.reducers.latest()` | Most recent GPS position (lat/lon) and speed |

---

### 4. Fleet-Wide Reduction (`reduce` without `groupby`)

**File:** `backend/pathway_pipeline.py`, Lines 86-91

```python
fleet_summary = enriched.reduce(
    total_fleet_co2=pw.reducers.sum(pw.this.co2_kg),
    total_records=pw.reducers.count(),
    avg_fleet_speed=pw.reducers.avg(pw.this.speed_kmph),
    avg_fleet_fuel=pw.reducers.avg(pw.this.fuel_rate_lph),
    total_idle_events=pw.reducers.sum(pw.this.is_idling),
)
```

A single `reduce()` without `groupby()` computes a **one-row summary** across the entire fleet. This is Pathway's equivalent of a global aggregation, and it updates incrementally as new telemetry arrives.

---

### 5. HTTP Input Connector (`pw.io.http.rest_connector`)

**File:** `backend/pathway_pipeline.py`, Lines 110-116

```python
input_table, response_writer = pw.io.http.rest_connector(
    host=host,
    port=port,
    schema=TelemetrySchema,
    autocommit_duration_ms=500,
    delete_completed_queries=True,
)
```

**Parameters used:**
- `host` / `port` — Binds to `0.0.0.0:8082` for receiving HTTP POSTs
- `schema=TelemetrySchema` — Validates incoming JSON against the defined schema
- `autocommit_duration_ms=500` — Batches records every 500ms before triggering recomputation
- `delete_completed_queries=True` — Cleans up processed queries to free memory

---

### 6. Output Connectors

**File:** `backend/pathway_pipeline.py`, Lines 122-128

```python
# Null sink for enriched records (used for side-effect triggering)
pw.io.null.write(outputs["enriched"])

# JSONL file output for per-truck aggregations
pw.io.jsonlines.write(outputs["per_truck"], "pathway_truck_output.jsonl")

# JSONL file output for fleet-wide summary
pw.io.jsonlines.write(outputs["fleet_summary"], "pathway_fleet_output.jsonl")
```

**Output connectors used:**
| Connector | Purpose |
|---|---|
| `pw.io.null.write()` | Consumes enriched table without storing (triggers computation) |
| `pw.io.jsonlines.write()` | Writes incremental updates to `.jsonl` files |

---

### 7. CSV Input Connector (Batch Mode)

**File:** `backend/pathway_pipeline.py`, Lines 138-142

```python
input_table = pw.io.csv.read(
    input_path,
    schema=TelemetrySchema,
    mode="static",
)
```

Used for **offline/batch testing** — reads a CSV file of historical telemetry and processes it through the same pipeline. The `mode="static"` flag tells Pathway to process the file once (not watch for changes).

---

### 8. Pipeline Execution (`pw.run`)

**File:** `backend/pathway_pipeline.py`, Line 131

```python
pw.run(monitoring_level=pw.MonitoringLevel.NONE)
```

Starts the Pathway runtime. `MonitoringLevel.NONE` disables internal telemetry reporting from the Pathway engine itself.

---

## Complete Pathway API Surface Used

| API | Category | Count of Usages |
|---|---|---|
| `pw.Schema` | Schema definition | 1 |
| `pw.Table.select()` | Column transformation | 1 |
| `pw.Table.groupby().reduce()` | Grouped aggregation | 1 |
| `pw.Table.reduce()` | Global aggregation | 1 |
| `pw.this` | Column reference | 15+ |
| `pw.cast()` | Type casting | 1 |
| `pw.reducers.sum()` | Sum reducer | 4 |
| `pw.reducers.avg()` | Average reducer | 4 |
| `pw.reducers.count()` | Count reducer | 2 |
| `pw.reducers.latest()` | Latest-value reducer | 3 |
| `pw.io.http.rest_connector()` | HTTP input | 1 |
| `pw.io.csv.read()` | CSV input | 1 |
| `pw.io.jsonlines.write()` | JSONL output | 2 |
| `pw.io.null.write()` | Null sink | 1 |
| `pw.run()` | Runtime execution | 2 |
| `pw.MonitoringLevel` | Configuration | 1 |

**Total: 16 distinct Pathway APIs used across 40+ invocations**

---

## Pipeline Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │           Pathway Streaming Pipeline          │
                    │                                              │
 Simulator ──POST──▶  pw.io.http.rest_connector (port 8082)      │
 (6 trucks,        │         │                                     │
  1s interval)     │         ▼                                     │
                    │  ┌─────────────┐                             │
                    │  │  select()   │  CO₂ enrichment per record  │
                    │  │  pw.this    │  is_idling detection        │
                    │  │  pw.cast    │  load_pct computation       │
                    │  └──────┬──────┘                             │
                    │         │                                     │
                    │    ┌────┴────┐                                │
                    │    ▼         ▼                                │
                    │ groupby()  reduce()                          │
                    │ .reduce()  (fleet-wide)                      │
                    │    │         │                                │
                    │    ▼         ▼                                │
                    │  jsonl     jsonl                              │
                    │  output    output                             │
                    └──────────────────────────────────────────────┘
```

### Three-Stage Pipeline:

1. **Stage 1 — CO₂ Enrichment** (`select`)
   - Input: Raw telemetry (truck_id, lat, lon, speed, fuel_rate, load, engine_status)
   - Output: Enriched record with `co2_kg`, `is_idling`, `load_pct` columns
   - Formula: `co2_kg = fuel_rate_lph × (1/3600) × 2.68` (IPCC diesel emission factor)

2. **Stage 2 — Per-Truck Aggregation** (`groupby.reduce`)
   - Groups by `truck_id`
   - Computes: total CO₂, average speed, average fuel rate, idle ticks, latest GPS
   - Uses 6 different reducers (sum, avg, count, latest)

3. **Stage 3 — Fleet Summary** (`reduce`)
   - Single-row global aggregation
   - Total fleet CO₂, record count, average speed/fuel, total idle events

---

## Pathway-Inspired Patterns in Application Code

Beyond the dedicated pipeline, Pathway's streaming computation concepts influenced the design of the entire backend:

### Incremental State Updates (`backend/compute.py`)

The `process_telemetry()` function mirrors Pathway's incremental paradigm:
- Reads previous state → Computes delta → Updates running totals
- CO₂ accumulates incrementally: `co2_today = previous_co2 + increment`
- Preserves full precision (no rounding during accumulation) to prevent data loss

### Rolling Window Buffers (`backend/state.py`)

The `FleetStateStore` implements 5-minute rolling windows similar to Pathway's temporal windowing:
```python
self._window_seconds = 300  # 5-minute rolling window
# Records automatically trimmed to window on each insert
```

### Streaming Reducers (Manual Implementation)

The fleet summary computation in `state.py` mirrors Pathway's reducer pattern:
```python
best = max(trucks, key=lambda t: t.green_score)      # pw.reducers.max equivalent
worst = min(trucks, key=lambda t: t.green_score)      # pw.reducers.min equivalent
avg_score = sum(t.green_score for t in trucks) / len  # pw.reducers.avg equivalent
total_co2 = sum(t.co2_today_kg for t in trucks)       # pw.reducers.sum equivalent
```

---

## Deployment Modes

| Mode | Command | Port | Use Case |
|---|---|---|---|
| HTTP Streaming | `python pathway_pipeline.py http` | 8082 | Production — live telemetry ingestion |
| CSV Batch | `python pathway_pipeline.py csv data.csv` | N/A | Testing — process historical data files |

---

## Dependencies

```
pathway==0.29.1       # Core streaming engine
python>=3.11,<3.14    # Python 3.13 recommended (3.14 incompatible with pyarrow)
```

Pathway internally depends on:
- `pyarrow` — Columnar data representation
- `numpy` — Numerical operations
- Rust-based engine — Core computation runtime

---

## Key Configuration Parameters

| Parameter | Value | Purpose |
|---|---|---|
| `CO2_EMISSION_FACTOR` | 2.68 kg/L | IPCC diesel emission factor |
| `TRUCK_CAPACITY` | 3000.0 kg | Max load per truck for utilization calculation |
| `autocommit_duration_ms` | 500 | Pathway batches records every 500ms |
| `MonitoringLevel` | NONE | Disabled internal Pathway telemetry |

---

## Summary

CarbonRoute AI uses Pathway as its **real-time streaming computation backbone** for processing fleet telemetry data. The pipeline transforms raw GPS/fuel/load data into CO₂ metrics, per-truck aggregations, and fleet-wide summaries — all computed incrementally as data flows in. The framework's built-in HTTP connector, typed schemas, and reducer library made it possible to build a production-grade streaming pipeline in under 200 lines of Python.
