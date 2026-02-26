"""Fleet Telemetry Simulator for CarbonRoute AI.

Simulates 6 trucks in the Delhi NCR region with realistic movement patterns.
Supports demo event flags for traffic jam, deviation, and idling scenarios.
"""
import asyncio
import json
import math
import random
import time
import sys
import httpx
from datetime import datetime, timezone

API_URL = "http://localhost:8000"

# Truck configurations
TRUCKS = {
    "T1": {
        "route": [(28.6139, 77.2090), (28.6180, 77.2120), (28.6220, 77.2160), (28.6260, 77.2130), (28.6300, 77.2080)],
        "load_kg": 1800, "base_fuel_rate": 4.5, "base_speed": 42,
    },
    "T2": {
        "route": [(28.6350, 77.2050), (28.6310, 77.2100), (28.6270, 77.2170), (28.6230, 77.2220), (28.6190, 77.2280)],
        "load_kg": 2200, "base_fuel_rate": 5.2, "base_speed": 38,
    },
    "T3": {
        "route": [(28.6450, 77.1950), (28.6410, 77.2000), (28.6370, 77.2060), (28.6330, 77.2130), (28.6290, 77.2190)],
        "load_kg": 800, "base_fuel_rate": 3.8, "base_speed": 45,
    },
    "T4": {
        "route": [(28.6100, 77.2300), (28.6140, 77.2260), (28.6180, 77.2200), (28.6220, 77.2130), (28.6260, 77.2060)],
        "load_kg": 2500, "base_fuel_rate": 5.8, "base_speed": 35,
    },
    "T5": {
        "route": [(28.6380, 77.2100), (28.6340, 77.2060), (28.6300, 77.2010), (28.6260, 77.1970), (28.6220, 77.1920)],
        "load_kg": 2800, "base_fuel_rate": 5.0, "base_speed": 40,
    },
    "T6": {
        "route": [(28.6200, 77.2250), (28.6240, 77.2290), (28.6280, 77.2340), (28.6320, 77.2300), (28.6360, 77.2250)],
        "load_kg": 1200, "base_fuel_rate": 4.2, "base_speed": 44,
    },
}


class TruckSimulator:
    """Simulates a single truck's telemetry."""

    def __init__(self, truck_id: str, config: dict):
        self.truck_id = truck_id
        self.route = config["route"]
        self.load_kg = config["load_kg"]
        self.base_fuel_rate = config["base_fuel_rate"]
        self.base_speed = config["base_speed"]

        # Current position along route (0.0 to 1.0, loops)
        self.progress = random.uniform(0, 0.3)
        self.direction = 1  # 1 = forward, -1 = backward

        # State
        self.current_lat = self.route[0][0]
        self.current_lon = self.route[0][1]
        self.speed = self.base_speed
        self.fuel_rate = self.base_fuel_rate
        self.is_idle = False
        self.is_deviated = False

    def _interpolate_route(self, progress: float):
        """Interpolate position along the route."""
        n = len(self.route)
        if n < 2:
            return self.route[0]

        # Map progress to route segment
        total_idx = progress * (n - 1)
        idx = int(total_idx)
        frac = total_idx - idx

        if idx >= n - 1:
            return self.route[-1]

        lat = self.route[idx][0] + frac * (self.route[idx + 1][0] - self.route[idx][0])
        lon = self.route[idx][1] + frac * (self.route[idx + 1][1] - self.route[idx][1])
        return lat, lon

    def tick(self, demo_flags: dict) -> dict:
        """Generate one telemetry tick."""
        # Apply demo flags
        is_jam = demo_flags.get("traffic_jam", False)
        is_deviation = demo_flags.get("deviation_t3", False) and self.truck_id == "T3"
        is_idle = demo_flags.get("idle_t4", False) and self.truck_id == "T4"

        # Update speed
        if is_idle:
            self.speed = 0
            self.fuel_rate = 1.8  # Idling fuel consumption
        elif is_jam:
            self.speed = max(2, self.base_speed * 0.15 + random.gauss(0, 2))
            self.fuel_rate = self.base_fuel_rate * 1.4  # Higher fuel in stop-go
        else:
            self.speed = max(0, self.base_speed + random.gauss(0, 5))
            self.fuel_rate = self.base_fuel_rate + random.gauss(0, 0.3)

        # Move along route
        if self.speed > 0 and not is_idle:
            # Speed in km/h -> progress per second
            step = (self.speed / 3600.0) / 25.0  # Assume 25km route length
            self.progress += step * self.direction

            # Bounce at ends
            if self.progress >= 1.0:
                self.progress = 1.0
                self.direction = -1
            elif self.progress <= 0.0:
                self.progress = 0.0
                self.direction = 1

        # Interpolate position
        lat, lon = self._interpolate_route(self.progress)

        # Apply deviation
        if is_deviation:
            lat += 0.008 + random.gauss(0, 0.001)  # ~800m off route
            lon += 0.006 + random.gauss(0, 0.001)
            self.fuel_rate *= 1.3  # Longer route = more fuel

        # Add small noise
        lat += random.gauss(0, 0.0001)
        lon += random.gauss(0, 0.0001)

        self.current_lat = lat
        self.current_lon = lon

        # Compute planned route id
        route_idx = int(self.truck_id[1:]) if self.truck_id[1:].isdigit() else 1
        route_id = f"R{route_idx}"

        return {
            "truck_id": self.truck_id,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "speed_kmph": round(max(0, self.speed), 1),
            "fuel_rate_lph": round(max(0.5, self.fuel_rate), 2),
            "load_kg": self.load_kg,
            "engine_status": "ON",
            "planned_route_id": route_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


async def run_simulator():
    """Run the fleet simulator, posting telemetry to the API."""
    print("[Simulator] Starting fleet telemetry simulator...")
    print(f"[Simulator] API target: {API_URL}/ingest")
    print(f"[Simulator] Simulating {len(TRUCKS)} trucks")

    simulators = {
        tid: TruckSimulator(tid, config)
        for tid, config in TRUCKS.items()
    }

    tick_count = 0
    async with httpx.AsyncClient(timeout=5.0) as client:
        while True:
            tick_count += 1

            # Get demo flags from API
            demo_flags = {"traffic_jam": False, "deviation_t3": False, "idle_t4": False}
            try:
                resp = await client.get(f"{API_URL}/demo_flags")
                if resp.status_code == 200:
                    demo_flags = resp.json()
            except Exception:
                pass

            # Generate and send telemetry for each truck
            for tid, sim in simulators.items():
                payload = sim.tick(demo_flags)
                try:
                    await client.post(f"{API_URL}/ingest", json=payload)
                except Exception as e:
                    if tick_count % 10 == 1:
                        print(f"[Simulator] Error sending {tid}: {e}")

            if tick_count % 10 == 0:
                print(f"[Simulator] Tick {tick_count} - {len(simulators)} trucks active")

            await asyncio.sleep(1.0)


if __name__ == "__main__":
    try:
        asyncio.run(run_simulator())
    except KeyboardInterrupt:
        print("\n[Simulator] Stopped.")
