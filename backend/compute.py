"""CO₂ computation engine and inefficiency detection for CarbonRoute AI.

Uses Pathway-inspired streaming computation concepts:
- Rolling window aggregations per truck
- Incremental CO₂ accumulation
- Real-time inefficiency rule evaluation
- Green Score computation
"""
import math
import time
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from models import (
    TelemetryPayload, TruckState, Alert, AlertType, AlertSeverity, EngineStatus
)
from state import fleet_store

# Constants
CO2_EMISSION_FACTOR = 2.68  # kg CO₂ per liter of diesel
IDLE_THRESHOLD_SECONDS = 300  # 5 minutes
FUEL_EXCESS_MULTIPLIER = 1.25  # 25% above fleet average
DEVIATION_THRESHOLD_METERS = 500
LOW_LOAD_THRESHOLD = 0.30  # 30% of capacity
TRUCK_CAPACITY_KG = 3000.0

# Planned routes (Delhi NCR region) - route_id -> list of (lat, lon) waypoints
PLANNED_ROUTES = {
    "R1": [(28.6139, 77.2090), (28.6200, 77.2150), (28.6280, 77.2200), (28.6350, 77.2100), (28.6400, 77.2000)],
    "R2": [(28.6300, 77.2000), (28.6250, 77.2100), (28.6200, 77.2200), (28.6150, 77.2300), (28.6100, 77.2400)],
    "R3": [(28.6500, 77.1900), (28.6450, 77.1950), (28.6400, 77.2050), (28.6350, 77.2150), (28.6300, 77.2250)],
    "R4": [(28.6100, 77.2300), (28.6150, 77.2250), (28.6200, 77.2150), (28.6250, 77.2050), (28.6300, 77.1950)],
    "R5": [(28.6400, 77.2100), (28.6350, 77.2050), (28.6300, 77.2000), (28.6250, 77.1950), (28.6200, 77.1900)],
    "R6": [(28.6200, 77.2250), (28.6250, 77.2300), (28.6300, 77.2350), (28.6350, 77.2300), (28.6400, 77.2250)],
}

# Location names for display
LOCATION_NAMES = {
    "T1": "Noida Sec 18",
    "T2": "Connaught Place",
    "T3": "Delhi - Sector 4",
    "T4": "Dwarka Expressway",
    "T5": "Gurugram Hwy",
    "T6": "Depot Return",
}


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in meters between two GPS coordinates."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def min_distance_to_route(lat: float, lon: float, route_id: str) -> float:
    """Returns minimum distance in meters from point to any waypoint on planned route."""
    route = PLANNED_ROUTES.get(route_id, [])
    if not route:
        return 0.0
    return min(haversine(lat, lon, wp[0], wp[1]) for wp in route)


def co2_to_trail_color(co2_per_km: float) -> List[int]:
    """Map CO₂/km to RGB color for smoke trail."""
    if co2_per_km < 0.10:
        return [34, 197, 94, 200]  # green
    elif co2_per_km < 0.20:
        return [234, 179, 8, 200]  # yellow
    else:
        return [239, 68, 68, 220]  # red


def compute_green_score(
    idle_minutes: float,
    fuel_excess_pct: float,
    deviation_km: float,
    load_pct: float
) -> int:
    """Compute Green Score (0-100) for a truck.

    Penalties:
    - Idle: up to 30 points (3 pts per minute)
    - Fuel excess: up to 30 points (0.6 pts per %)
    - Deviation: up to 20 points (10 pts per km)
    - Low load: up to 20 points
    """
    score = 100.0
    score -= min(idle_minutes * 3, 30)
    score -= min(fuel_excess_pct * 0.6, 30)
    score -= min(deviation_km * 10, 20)
    score -= min((1.0 - load_pct) * 20, 20)
    return max(0, int(round(score)))


def get_badge(score: int) -> str:
    """Get badge string from Green Score."""
    if score >= 80:
        return "GREEN"
    elif score >= 50:
        return "YELLOW"
    else:
        return "RED"


def process_telemetry(payload: TelemetryPayload) -> TruckState:
    """Process a single telemetry record: compute CO₂, detect inefficiencies, update state.

    This function implements Pathway-style incremental computation:
    - Reads previous state
    - Computes delta
    - Updates rolling window
    - Evaluates rules
    - Returns new state
    """
    now_ts = time.time()
    truck_id = payload.truck_id

    # Get previous state
    prev_state = fleet_store.get_truck(truck_id)

    # Compute delta time
    delta_t_seconds = 1.0  # default 1 second
    if prev_state and prev_state.last_timestamp:
        try:
            prev_dt = datetime.fromisoformat(prev_state.last_timestamp.replace("Z", "+00:00"))
            curr_dt = datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
            delta_t_seconds = max(0.1, (curr_dt - prev_dt).total_seconds())
        except Exception:
            delta_t_seconds = 1.0

    # --- CO₂ Computation ---
    # co2_kg = fuel_rate_lph × (Δt/3600) × 2.68
    co2_increment = payload.fuel_rate_lph * (delta_t_seconds / 3600.0) * CO2_EMISSION_FACTOR
    co2_rate_kgph = payload.fuel_rate_lph * CO2_EMISSION_FACTOR
    co2_today = (prev_state.co2_today_kg if prev_state else 0.0) + co2_increment

    # --- Distance computation ---
    distance_increment = 0.0
    if prev_state:
        distance_increment = haversine(prev_state.lat, prev_state.lon, payload.lat, payload.lon) / 1000.0  # km
    total_distance = (prev_state.total_distance_km if prev_state else 0.0) + distance_increment

    # CO₂ per km for trail color
    co2_per_km = co2_rate_kgph / max(payload.speed_kmph, 1.0) if payload.speed_kmph > 0 else 0.25

    # --- Update trail ---
    trail = list(prev_state.trail) if prev_state else []
    trail_colors = list(prev_state.trail_colors) if prev_state else []
    trail.append([payload.lon, payload.lat])
    trail_colors.append(co2_to_trail_color(co2_per_km))
    max_trail = 15
    if len(trail) > max_trail:
        trail = trail[-max_trail:]
        trail_colors = trail_colors[-max_trail:]

    # --- Rolling window update ---
    window_record = {
        "ts": now_ts,
        "fuel_rate": payload.fuel_rate_lph,
        "speed": payload.speed_kmph,
        "co2": co2_increment,
        "idle": 1 if (payload.speed_kmph == 0 and payload.engine_status == EngineStatus.ON) else 0,
    }
    fleet_store.add_window_record(truck_id, window_record)
    window_records = fleet_store.get_window_records(truck_id)

    # Compute window averages
    if window_records:
        avg_fuel = sum(r["fuel_rate"] for r in window_records) / len(window_records)
        avg_speed = sum(r["speed"] for r in window_records) / len(window_records)
        idle_seconds = sum(r["idle"] for r in window_records) * delta_t_seconds
    else:
        avg_fuel = payload.fuel_rate_lph
        avg_speed = payload.speed_kmph
        idle_seconds = 0.0

    # Accumulate idle time
    if payload.speed_kmph == 0 and payload.engine_status == EngineStatus.ON:
        idle_seconds = (prev_state.idle_seconds if prev_state else 0.0) + delta_t_seconds
    else:
        idle_seconds = max(0, (prev_state.idle_seconds if prev_state else 0.0) - delta_t_seconds * 0.5)  # decay

    # --- Inefficiency Detection ---
    fleet_avg_fuel = fleet_store.get_fleet_avg_fuel_rate()
    route_id = payload.planned_route_id or f"R{int(truck_id[1:]) if truck_id[1:].isdigit() else 1}"
    deviation_m = min_distance_to_route(payload.lat, payload.lon, route_id)
    deviation_km = deviation_m / 1000.0
    load_pct = payload.load_kg / TRUCK_CAPACITY_KG

    active_alert_msg = None
    now_iso = datetime.now(timezone.utc).isoformat()

    # Rule 1: Idling
    if payload.speed_kmph == 0 and payload.engine_status == EngineStatus.ON and idle_seconds > IDLE_THRESHOLD_SECONDS:
        idle_min = int(idle_seconds / 60)
        alert = Alert(
            truck_id=truck_id,
            alert_type=AlertType.IDLING,
            message=f"{truck_id} idling for {idle_min} minutes with engine ON",
            severity=AlertSeverity.HIGH,
            timestamp=now_iso,
        )
        fleet_store.add_alert(alert)
        active_alert_msg = f"IDLING - {idle_min} minutes"
    else:
        fleet_store.resolve_alert(truck_id, AlertType.IDLING)

    # Rule 2: High Fuel Consumption
    if fleet_avg_fuel > 0 and payload.fuel_rate_lph > fleet_avg_fuel * FUEL_EXCESS_MULTIPLIER:
        excess_pct = int(((payload.fuel_rate_lph / fleet_avg_fuel) - 1) * 100)
        alert = Alert(
            truck_id=truck_id,
            alert_type=AlertType.HIGH_FUEL,
            message=f"{truck_id} fuel rate {excess_pct}% above fleet average",
            severity=AlertSeverity.MEDIUM,
            timestamp=now_iso,
        )
        fleet_store.add_alert(alert)
        if not active_alert_msg:
            active_alert_msg = f"HIGH FUEL - {excess_pct}% above avg"
    else:
        fleet_store.resolve_alert(truck_id, AlertType.HIGH_FUEL)

    # Rule 3: Route Deviation
    if deviation_m > DEVIATION_THRESHOLD_METERS:
        alert = Alert(
            truck_id=truck_id,
            alert_type=AlertType.DEVIATION,
            message=f"{truck_id} deviated {int(deviation_m)}m from planned route",
            severity=AlertSeverity.HIGH,
            timestamp=now_iso,
        )
        fleet_store.add_alert(alert)
        if not active_alert_msg:
            active_alert_msg = f"DEVIATION - {int(deviation_m)}m off route"
    else:
        fleet_store.resolve_alert(truck_id, AlertType.DEVIATION)

    # Rule 4: Low Load
    if load_pct < LOW_LOAD_THRESHOLD:
        alert = Alert(
            truck_id=truck_id,
            alert_type=AlertType.LOW_LOAD,
            message=f"{truck_id} running at {int(load_pct * 100)}% load capacity",
            severity=AlertSeverity.LOW,
            timestamp=now_iso,
        )
        fleet_store.add_alert(alert)
        if not active_alert_msg:
            active_alert_msg = f"LOW LOAD - {int(load_pct * 100)}% capacity"
    else:
        fleet_store.resolve_alert(truck_id, AlertType.LOW_LOAD)

    # --- Green Score ---
    idle_minutes = idle_seconds / 60.0
    fuel_excess_pct = max(0, ((payload.fuel_rate_lph / max(fleet_avg_fuel, 1)) - 1) * 100) if fleet_avg_fuel > 0 else 0
    green_score = compute_green_score(idle_minutes, fuel_excess_pct, deviation_km, load_pct)
    badge = get_badge(green_score)

    # ETA estimation
    eta_min = 0.0
    remaining_dist = max(0, 25.0 - total_distance)  # Assume 25km route
    if payload.speed_kmph > 0:
        eta_min = (remaining_dist / payload.speed_kmph) * 60

    # Build new state
    new_state = TruckState(
        truck_id=truck_id,
        lat=payload.lat,
        lon=payload.lon,
        speed_kmph=payload.speed_kmph,
        fuel_rate_lph=payload.fuel_rate_lph,
        load_kg=payload.load_kg,
        engine_status=payload.engine_status,
        co2_rate_kgph=round(co2_rate_kgph, 2),
        co2_today_kg=co2_today,  # Don't round - preserve accumulation precision
        green_score=green_score,
        green_badge=badge,
        active_alert=active_alert_msg,
        trail=trail,
        trail_colors=trail_colors,
        last_timestamp=payload.timestamp,
        idle_seconds=idle_seconds,
        avg_fuel_rate_5min=round(avg_fuel, 2),
        avg_speed_5min=round(avg_speed, 1),
        total_distance_km=round(total_distance, 2),
        load_capacity_kg=TRUCK_CAPACITY_KG,
        eta_minutes=round(eta_min, 1),
        location_name=LOCATION_NAMES.get(truck_id, "Unknown"),
    )

    fleet_store.update_truck(truck_id, new_state)
    return new_state
