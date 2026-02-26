"""RAG (Retrieval-Augmented Generation) Provider for CarbonRoute AI.

Answers natural language questions using live fleet data as context.
Uses OpenAI GPT-4o-mini with fallback to template-based responses.
"""
import os
from datetime import datetime, timezone
from typing import List, Tuple
from dotenv import load_dotenv

load_dotenv()


class RAGProvider:
    """RAG-based fleet sustainability analyst."""

    def __init__(self):
        self._openai_client = None
        self._init_openai()

    def _init_openai(self):
        """Initialize OpenAI client if API key is available."""
        api_key = os.getenv("OPENAI_API_KEY", "")
        if api_key and not api_key.startswith("sk-your"):
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=api_key)
                print("[RAG] OpenAI client initialized successfully")
            except Exception as e:
                print(f"[RAG] OpenAI init failed: {e}. Using fallback mode.")
                self._openai_client = None
        else:
            print("[RAG] No OpenAI API key found. Using fallback template mode.")

    def build_context(self, fleet_state: dict, alerts: list, snapshots: list) -> str:
        """Build context string from live fleet data."""
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # Fleet summary
        trucks = fleet_state.get("trucks", {})
        total_co2 = sum(t.get("co2_today_kg", 0) for t in trucks.values())
        active_alerts = [a for a in alerts if not a.get("resolved", False)]

        best_truck = max(trucks.values(), key=lambda t: t.get("green_score", 0)) if trucks else {}
        worst_truck = min(trucks.values(), key=lambda t: t.get("green_score", 100)) if trucks else {}

        # Build context
        context = f"""Fleet Summary as of {now}:
- Total CO₂ today: {total_co2:.1f} kg
- Active alerts: {len(active_alerts)}
- Fleet size: {len(trucks)} trucks
- Best truck: {best_truck.get('truck_id', 'N/A')} (Green Score {best_truck.get('green_score', 0)})
- Worst truck: {worst_truck.get('truck_id', 'N/A')} (Green Score {worst_truck.get('green_score', 100)})

Per-Truck Details:
"""
        for tid, t in trucks.items():
            context += f"- {tid}: Score={t.get('green_score', 0)}, CO₂={t.get('co2_today_kg', 0):.1f}kg, "
            context += f"Speed={t.get('speed_kmph', 0)}km/h, Fuel={t.get('fuel_rate_lph', 0)}L/h, "
            context += f"Load={t.get('load_kg', 0)}kg, Location={t.get('location_name', 'Unknown')}"
            if t.get('active_alert'):
                context += f" [ALERT: {t['active_alert']}]"
            context += "\n"

        context += f"\nActive Alerts ({len(active_alerts)}):\n"
        for a in active_alerts[:5]:
            context += f"- {a.get('truck_id', '')}: {a.get('alert_type', '')} - {a.get('message', '')}\n"

        if snapshots:
            context += f"\nRecent Ledger Hashes (last {len(snapshots)} snapshots):\n"
            for s in snapshots[:5]:
                context += f"- {s.get('timestamp', '')}: #{s.get('hash', '')[:12]}...\n"

        context += """
Policy: Trucks emitting > 115g CO₂/km are classified inefficient per Indian MoRTH guidelines.
Emission factor: 2.68 kg CO₂ per liter of diesel.
Green Score: 0-100 scale (80+ GREEN, 50-79 YELLOW, <50 RED).
"""
        return context

    async def query(self, question: str, fleet_state: dict, alerts: list, snapshots: list) -> Tuple[str, List[str]]:
        """Answer a question using fleet context + LLM. Returns (answer, citations)."""
        context = self.build_context(fleet_state, alerts, snapshots)

        if self._openai_client:
            try:
                return await self._query_openai(question, context, snapshots)
            except Exception as e:
                print(f"[RAG] OpenAI call failed, using fallback: {e}")
                return self._query_fallback(question, fleet_state, alerts, snapshots)
        else:
            return self._query_fallback(question, fleet_state, alerts, snapshots)

    async def _query_openai(self, question: str, context: str, snapshots: list) -> Tuple[str, List[str]]:
        """Query OpenAI GPT-4o-mini with fleet context."""
        system_prompt = """You are a fleet sustainability analyst for Smart Green Logistics, India.
You analyze real-time fleet telemetry data and provide actionable insights about carbon emissions,
fuel efficiency, and sustainability. Always cite specific data from the context provided.
When referencing verification data, cite ledger hash values. Keep responses concise (2-4 sentences)."""

        response = self._openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{context}\n\nQuestion: {question}"},
            ],
            max_tokens=300,
            temperature=0.3,
        )

        answer = response.choices[0].message.content
        citations = []
        if snapshots:
            citations = [f"#{s.get('hash', '')[:12]}" for s in snapshots[:2]]

        return answer, citations

    def _query_fallback(self, question: str, fleet_state: dict, alerts: list, snapshots: list) -> Tuple[str, List[str]]:
        """Template-based fallback when OpenAI is unavailable."""
        trucks = fleet_state.get("trucks", {})
        total_co2 = sum(t.get("co2_today_kg", 0) for t in trucks.values())
        active_alerts = [a for a in alerts if not a.get("resolved", False)]
        q_lower = question.lower()

        citations = []
        if snapshots:
            citations = [f"#{s.get('hash', '')[:12]}" for s in snapshots[:2]]

        # Pattern matching for common queries
        if "most" in q_lower and ("co2" in q_lower or "emit" in q_lower or "pollut" in q_lower):
            worst = max(trucks.values(), key=lambda t: t.get("co2_today_kg", 0)) if trucks else {}
            return (
                f"{worst.get('truck_id', 'Unknown')} has emitted the most CO₂ today at "
                f"{worst.get('co2_today_kg', 0):.1f} kg. Its Green Score is {worst.get('green_score', 0)}, "
                f"indicating {('poor' if worst.get('green_score', 0) < 50 else 'moderate')} efficiency. "
                f"Key factors include fuel rate of {worst.get('fuel_rate_lph', 0)} L/hr."
                + (f" Verified: ledger {citations[0]}" if citations else ""),
                citations,
            )

        elif "spike" in q_lower or "why" in q_lower:
            spike_trucks = [t for t in trucks.values() if t.get("active_alert")]
            if spike_trucks:
                t = spike_trucks[0]
                return (
                    f"Emission spike detected for {t.get('truck_id', '')}. "
                    f"Alert: {t.get('active_alert', 'Unknown issue')}. "
                    f"Current CO₂ rate is {t.get('co2_rate_kgph', 0)} kg/hr, "
                    f"which is significantly above optimal levels. "
                    f"The truck is at {t.get('location_name', 'unknown location')}."
                    + (f" Ledger reference: {citations[0]}" if citations else ""),
                    citations,
                )
            return (f"Total fleet CO₂ today is {total_co2:.1f} kg. No major spikes detected currently.", citations)

        elif "reduce" in q_lower or "improve" in q_lower or "how" in q_lower:
            return (
                f"To reduce fleet CO₂ ({total_co2:.1f} kg today): "
                "1) Eliminate idling events - each idle minute costs ~0.045 kg CO₂. "
                "2) Optimize routes to avoid deviations. "
                "3) Improve load utilization - trucks below 30% capacity waste fuel per kg. "
                f"Currently {len(active_alerts)} alerts are active."
                + (f" Ledger: {citations[0]}" if citations else ""),
                citations,
            )

        elif "green score" in q_lower or "score" in q_lower:
            # Find specific truck mention
            for tid in ["T1", "T2", "T3", "T4", "T5", "T6"]:
                if tid.lower() in q_lower:
                    t = trucks.get(tid, {})
                    return (
                        f"{tid}'s Green Score is {t.get('green_score', 0)}/100 ({t.get('green_badge', 'N/A')}). "
                        f"CO₂ rate: {t.get('co2_rate_kgph', 0)} kg/hr. "
                        f"Load: {t.get('load_kg', 0)}/{t.get('load_capacity_kg', 3000)} kg. "
                        f"Speed: {t.get('speed_kmph', 0)} km/h."
                        + (f" Verified: {citations[0]}" if citations else ""),
                        citations,
                    )
            # General fleet score
            scores = {tid: t.get("green_score", 0) for tid, t in trucks.items()}
            avg = sum(scores.values()) / len(scores) if scores else 0
            return (
                f"Fleet average Green Score: {avg:.0f}/100. "
                f"Scores: {', '.join(f'{k}={v}' for k, v in sorted(scores.items(), key=lambda x: x[1]))}."
                + (f" Reference: {citations[0]}" if citations else ""),
                citations,
            )

        elif "inefficient" in q_lower:
            worst = min(trucks.values(), key=lambda t: t.get("green_score", 100)) if trucks else {}
            return (
                f"{worst.get('truck_id', 'Unknown')} is the most inefficient truck "
                f"with a Green Score of {worst.get('green_score', 0)}/100. "
                f"Issues: {worst.get('active_alert', 'Cumulative inefficiency')}. "
                f"CO₂ rate: {worst.get('co2_rate_kgph', 0)} kg/hr."
                + (f" Ledger: {citations[0]}" if citations else ""),
                citations,
            )

        else:
            return (
                f"Fleet status: {len(trucks)} trucks active, {total_co2:.1f} kg CO₂ today, "
                f"{len(active_alerts)} active alerts. "
                f"Ask about specific trucks, emission spikes, Green Scores, or reduction strategies."
                + (f" Latest hash: {citations[0]}" if citations else ""),
                citations,
            )


# Global RAG instance
rag_provider = RAGProvider()
