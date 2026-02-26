"""Data models for CarbonRoute AI."""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class EngineStatus(str, Enum):
    ON = "ON"
    OFF = "OFF"


class TelemetryPayload(BaseModel):
    truck_id: str
    lat: float
    lon: float
    speed_kmph: float
    fuel_rate_lph: float
    load_kg: float
    engine_status: EngineStatus
    planned_route_id: Optional[str] = None
    timestamp: str  # ISO format


class AlertType(str, Enum):
    IDLING = "IDLING"
    HIGH_FUEL = "HIGH_FUEL"
    DEVIATION = "DEVIATION"
    LOW_LOAD = "LOW_LOAD"


class AlertSeverity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Alert(BaseModel):
    truck_id: str
    alert_type: AlertType
    message: str
    severity: AlertSeverity
    timestamp: str
    resolved: bool = False


class TruckState(BaseModel):
    truck_id: str
    lat: float
    lon: float
    speed_kmph: float
    fuel_rate_lph: float
    load_kg: float
    engine_status: EngineStatus
    co2_rate_kgph: float = 0.0
    co2_today_kg: float = 0.0
    green_score: int = 100
    green_badge: str = "GREEN"
    active_alert: Optional[str] = None
    trail: List[List[float]] = []  # [[lon, lat], ...]
    trail_colors: List[List[int]] = []  # [[R,G,B], ...]
    last_timestamp: str = ""
    idle_seconds: float = 0.0
    avg_fuel_rate_5min: float = 0.0
    avg_speed_5min: float = 0.0
    total_distance_km: float = 0.0
    load_capacity_kg: float = 3000.0
    eta_minutes: float = 0.0
    location_name: str = ""


class FleetSummary(BaseModel):
    total_co2_today: float = 0.0
    active_alerts: int = 0
    best_truck_id: str = ""
    best_truck_score: int = 0
    worst_truck_id: str = ""
    worst_truck_score: int = 100
    avg_green_score: float = 0.0
    total_trucks: int = 0
    active_trucks: int = 0


class RAGQuery(BaseModel):
    question: str


class RAGResponse(BaseModel):
    answer: str
    citations: List[str] = []


class RevenueCalcRequest(BaseModel):
    num_trucks: int = 100
    liters_saved_per_day: float = 2.0
    price_per_tco2: float = 5.0


class RevenueCalcResponse(BaseModel):
    annual_tonnes_saved: float
    gross_annual_revenue: float
    platform_revenue: float
    daily_co2_saved_kg: float


class DemoEvent(BaseModel):
    event_type: str  # traffic_jam, deviation_t3, idle_t4, reset
