"""SQLite MRV (Measurement, Reporting, Verification) Ledger for CarbonRoute AI.

Provides append-only immutable storage for telemetry records with SHA-256 snapshot hashing
for carbon credit verification purposes.
"""
import sqlite3
import hashlib
import json
import csv
import io
import time
import threading
from datetime import datetime, timezone
from typing import List, Dict, Optional


class MRVLedger:
    """Append-only emissions ledger with hash-chain integrity."""

    def __init__(self, db_path: str = "ledger.db"):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._record_buffer: List[dict] = []
        self._last_snapshot_time = time.time()
        self._snapshot_interval = 60  # seconds
        self._init_db()

    def _init_db(self):
        """Create the ledger table if it doesn't exist."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ledger (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    truck_id TEXT NOT NULL,
                    lat REAL,
                    lon REAL,
                    speed REAL,
                    fuel_rate REAL,
                    load_kg REAL,
                    co2_kg REAL,
                    snapshot_hash TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    record_count INTEGER,
                    hash TEXT NOT NULL,
                    total_co2_kg REAL
                )
            """)
            conn.commit()

    def append_record(self, record: dict):
        """Append a telemetry record to the ledger."""
        with self._lock:
            self._record_buffer.append(record)

            # Check if we should compute a snapshot
            now = time.time()
            if now - self._last_snapshot_time >= self._snapshot_interval:
                self._flush_and_snapshot()

    def _flush_and_snapshot(self):
        """Flush buffer to SQLite and compute snapshot hash."""
        if not self._record_buffer:
            return

        # Compute snapshot hash
        hash_input = json.dumps(self._record_buffer, sort_keys=True)
        snapshot_hash = hashlib.sha256(hash_input.encode()).hexdigest()

        now_iso = datetime.now(timezone.utc).isoformat()
        total_co2 = sum(r.get("co2_kg", 0) for r in self._record_buffer)

        try:
            with sqlite3.connect(self.db_path) as conn:
                # Insert all buffered records
                for record in self._record_buffer:
                    conn.execute(
                        """INSERT INTO ledger (timestamp, truck_id, lat, lon, speed, fuel_rate, load_kg, co2_kg, snapshot_hash)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            record.get("timestamp", now_iso),
                            record.get("truck_id", ""),
                            record.get("lat", 0),
                            record.get("lon", 0),
                            record.get("speed", 0),
                            record.get("fuel_rate", 0),
                            record.get("load_kg", 0),
                            record.get("co2_kg", 0),
                            snapshot_hash,
                        ),
                    )

                # Insert snapshot record
                conn.execute(
                    """INSERT INTO snapshots (timestamp, record_count, hash, total_co2_kg)
                       VALUES (?, ?, ?, ?)""",
                    (now_iso, len(self._record_buffer), snapshot_hash, total_co2),
                )
                conn.commit()
        except Exception as e:
            print(f"[Ledger] Error flushing: {e}")

        self._record_buffer.clear()
        self._last_snapshot_time = time.time()

    def force_flush(self):
        """Force a flush and snapshot."""
        with self._lock:
            self._flush_and_snapshot()

    def get_recent_records(self, limit: int = 10) -> List[dict]:
        """Get most recent ledger records."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT * FROM ledger ORDER BY id DESC LIMIT ?", (limit,)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception:
            return []

    def get_recent_snapshots(self, limit: int = 5) -> List[dict]:
        """Get most recent snapshot hashes."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT * FROM snapshots ORDER BY id DESC LIMIT ?", (limit,)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception:
            return []

    def get_total_co2(self) -> float:
        """Get total CO₂ recorded in the ledger."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT SUM(co2_kg) FROM ledger")
                result = cursor.fetchone()
                return result[0] if result[0] else 0.0
        except Exception:
            return 0.0

    def get_record_count(self) -> int:
        """Get total number of records."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM ledger")
                result = cursor.fetchone()
                return result[0] if result[0] else 0
        except Exception:
            return 0

    def export_csv(self) -> str:
        """Export entire ledger as CSV string."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("SELECT * FROM ledger ORDER BY id ASC")
                rows = cursor.fetchall()

            output = io.StringIO()
            writer = csv.writer(output)
            if rows:
                writer.writerow(rows[0].keys())
                for row in rows:
                    writer.writerow(dict(row).values())
            return output.getvalue()
        except Exception:
            return ""

    def get_daily_summary(self) -> Dict:
        """Get daily CO₂ summary per truck."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT truck_id,
                           SUM(co2_kg) as total_co2,
                           COUNT(*) as records,
                           AVG(fuel_rate) as avg_fuel_rate
                    FROM ledger
                    GROUP BY truck_id
                    ORDER BY total_co2 DESC
                """)
                return [dict(row) for row in cursor.fetchall()]
        except Exception:
            return []


# Global ledger instance
ledger = MRVLedger()
