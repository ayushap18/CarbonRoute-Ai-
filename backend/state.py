"""In-memory state store for CarbonRoute AI fleet data."""
import threading
import time
from typing import Dict, List, Optional
from datetime import datetime, timezone
from models import TruckState, Alert, FleetSummary, AlertSeverity


class FleetStateStore:
    """Thread-safe in-memory state store for fleet telemetry and computed metrics."""

    def __init__(self):
        self._lock = threading.Lock()
        self._trucks: Dict[str, TruckState] = {}
        self._alerts: List[Alert] = []
        self._demo_flags: Dict[str, bool] = {
            "traffic_jam": False,
            "deviation_t3": False,
            "idle_t4": False,
        }
        # Rolling window buffers: truck_id -> list of (timestamp, fuel_rate, speed, co2)
        self._window_buffers: Dict[str, List[dict]] = {}
        self._window_seconds = 300  # 5 minutes
        self._max_trail_points = 15

    def get_truck(self, truck_id: str) -> Optional[TruckState]:
        with self._lock:
            return self._trucks.get(truck_id)

    def update_truck(self, truck_id: str, state: TruckState):
        with self._lock:
            self._trucks[truck_id] = state

    def get_all_trucks(self) -> Dict[str, TruckState]:
        with self._lock:
            return dict(self._trucks)

    def add_alert(self, alert: Alert):
        with self._lock:
            # Check for duplicate active alerts
            for existing in self._alerts:
                if (existing.truck_id == alert.truck_id and
                        existing.alert_type == alert.alert_type and
                        not existing.resolved):
                    return  # Already have this alert active
            self._alerts.append(alert)
            # Keep max 20 alerts
            if len(self._alerts) > 20:
                self._alerts = self._alerts[-20:]

    def resolve_alert(self, truck_id: str, alert_type: str):
        with self._lock:
            for alert in self._alerts:
                if alert.truck_id == truck_id and alert.alert_type == alert_type:
                    alert.resolved = True

    def get_active_alerts(self) -> List[Alert]:
        with self._lock:
            return [a for a in self._alerts if not a.resolved]

    def get_all_alerts(self) -> List[Alert]:
        with self._lock:
            return [a for a in self._alerts if not a.resolved][-10:]

    def add_window_record(self, truck_id: str, record: dict):
        with self._lock:
            if truck_id not in self._window_buffers:
                self._window_buffers[truck_id] = []
            self._window_buffers[truck_id].append(record)
            # Trim to window
            now = time.time()
            self._window_buffers[truck_id] = [
                r for r in self._window_buffers[truck_id]
                if now - r.get("ts", 0) < self._window_seconds
            ]

    def get_window_records(self, truck_id: str) -> List[dict]:
        with self._lock:
            now = time.time()
            records = self._window_buffers.get(truck_id, [])
            return [r for r in records if now - r.get("ts", 0) < self._window_seconds]

    def get_fleet_avg_fuel_rate(self) -> float:
        with self._lock:
            if not self._trucks:
                return 0.0
            rates = [t.fuel_rate_lph for t in self._trucks.values() if t.fuel_rate_lph > 0]
            return sum(rates) / len(rates) if rates else 0.0

    def get_fleet_summary(self) -> FleetSummary:
        with self._lock:
            trucks = list(self._trucks.values())
            if not trucks:
                return FleetSummary()

            active_alerts = [a for a in self._alerts if not a.resolved]
            best = max(trucks, key=lambda t: t.green_score)
            worst = min(trucks, key=lambda t: t.green_score)
            avg_score = sum(t.green_score for t in trucks) / len(trucks)

            return FleetSummary(
                total_co2_today=round(sum(t.co2_today_kg for t in trucks), 1),
                active_alerts=len(active_alerts),
                best_truck_id=best.truck_id,
                best_truck_score=best.green_score,
                worst_truck_id=worst.truck_id,
                worst_truck_score=worst.green_score,
                avg_green_score=round(avg_score, 1),
                total_trucks=len(trucks),
                active_trucks=len([t for t in trucks if t.engine_status == "ON"]),
            )

    def set_demo_flag(self, flag: str, value: bool):
        with self._lock:
            if flag in self._demo_flags:
                self._demo_flags[flag] = value

    def get_demo_flags(self) -> Dict[str, bool]:
        with self._lock:
            return dict(self._demo_flags)

    def reset_demo(self):
        with self._lock:
            for key in self._demo_flags:
                self._demo_flags[key] = False
            # Resolve all alerts
            for alert in self._alerts:
                alert.resolved = True


# Global state instance
fleet_store = FleetStateStore()
