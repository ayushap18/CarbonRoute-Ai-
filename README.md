# CarbonRoute AI

### Smart Green Logistics & Carbon Footprint Tracker

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Pathway-0.29-blueviolet?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Google_Maps-API-4285F4?style=for-the-badge&logo=googlemaps&logoColor=white" />
</p>

---

## About

**CarbonRoute AI** is a real-time fleet emissions monitoring and carbon intelligence platform designed for logistics operators targeting carbon credit monetization. The system ingests live GPS, fuel, speed, and load telemetry from fleet vehicles and computes per-truck CO2 emissions using IPCC-standard diesel emission factors (2.68 kg CO2/liter).

Powered by a **Pathway streaming pipeline**, the platform processes telemetry data in real-time, detecting operational inefficiencies such as excessive idling, route deviations, fuel overconsumption, and underloaded trips. Each truck is assigned a dynamic **Green Score (0-100)** based on weighted penalty factors, enabling instant fleet-wide performance benchmarking.

All emissions data is stored in a tamper-evident **MRV (Measurement, Reporting, Verification) ledger** secured with SHA-256 hash chain integrity. This makes the data fully auditable and compliant with carbon credit claim requirements under **Verra VCS** and **Gold Standard** methodologies.

The platform features a professional **6-screen dashboard** with live Google Maps fleet tracking, fleet analytics with leaderboards and score breakdowns, an MRV audit trail viewer, a carbon credit revenue calculator with PDF verification reports, a RAG-powered AI analyst for natural language fleet queries, and a real-time alert monitoring center.

CarbonRoute AI bridges the gap between fleet operations and carbon markets — turning fuel efficiency into verifiable, monetizable emission reductions.

---

## Features

- **Live Fleet Tracking** — Real-time Google Maps integration with dark-themed styling, animated truck markers, polyline trails, and planned route overlays
- **Digital Twin Cards** — Per-truck live dashboards showing speed, fuel rate, CO2, load factor, and Green Score with color-coded badges
- **Green Score Engine** — Dynamic 0-100 scoring system with penalties for idling, fuel excess, route deviation, and low load
- **CO2 Computation** — IPCC-compliant calculation: `fuel_rate_lph x (delta_t / 3600) x 2.68`
- **MRV Ledger** — Append-only SQLite ledger with SHA-256 hash chain for tamper-evident audit trails
- **Carbon Credit Calculator** — Revenue projections based on configurable credit price, compliance rate, and verification costs
- **RAG AI Analyst** — Natural language queries powered by Retrieval-Augmented Generation over live fleet data
- **Smart Alerts** — Automated detection of idling, high fuel consumption, route deviation, and low load events
- **PDF Reports** — Downloadable verification reports for carbon credit claims
- **CSV Export** — Full ledger data export for external auditing tools
- **Demo Controls** — Built-in traffic jam, route deviation, and idle scenario triggers for testing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.8, Tailwind CSS v4, Vite 6 |
| **Maps** | Google Maps JavaScript API via `@react-google-maps/api` |
| **Backend** | Python 3.13, FastAPI 0.115, Uvicorn |
| **Streaming** | Pathway v0.29 real-time data processing pipeline |
| **Database** | SQLite (MRV Ledger with hash chain) |
| **AI/RAG** | Pathway RAG provider with fleet context injection |
| **Reports** | ReportLab (PDF generation) |

---

## Architecture

```
CarbonRoute AI
├── backend/                    # FastAPI + Pathway backend
│   ├── main.py                 # FastAPI app with 12+ REST endpoints
│   ├── simulator.py            # 6-truck real-time telemetry simulator
│   ├── pathway_pipeline.py     # Pathway streaming pipeline
│   ├── compute.py              # CO2 computation + Green Score engine
│   ├── state.py                # Global fleet state manager
│   ├── ledger.py               # MRV ledger with SHA-256 hash chain
│   ├── rag_provider.py         # RAG AI query provider
│   ├── pdf_report.py           # PDF verification report generator
│   └── models.py               # Pydantic data models
│
└── frontend design/            # React + TypeScript frontend
    └── src/
        ├── App.tsx             # Shell: FleetProvider + Sidebar + PageRouter
        ├── api.ts              # API client with all backend endpoints
        ├── types.ts            # TypeScript interfaces and utility functions
        ├── context/
        │   └── FleetContext.tsx # Global polling state (1.2s intervals)
        ├── hooks/
        │   └── useAnimatedCounter.ts
        ├── components/
        │   ├── Sidebar.tsx     # Navigation + CO2 counter + demo controls
        │   ├── LiveMap.tsx     # Google Maps with dark theme
        │   ├── TwinCard.tsx    # Digital twin truck cards
        │   ├── KpiCard.tsx     # Animated KPI display
        │   ├── BarChart.tsx    # Pure CSS/SVG bar charts
        │   └── DemoButton.tsx  # Demo scenario trigger buttons
        └── pages/
            ├── DashboardPage.tsx   # Live map + KPIs + Digital Twins
            ├── AnalyticsPage.tsx   # Leaderboard + charts + scores
            ├── LedgerPage.tsx      # MRV audit trail + exports
            ├── RevenuePage.tsx     # Carbon credit calculator
            ├── ChatPage.tsx        # RAG AI chat interface
            └── AlertsPage.tsx      # Alert monitoring center
```

---

## Dashboard Screens

### 1. Dashboard
Live Google Maps fleet tracking with animated truck markers, KPI summary bar, and digital twin cards for each truck showing real-time telemetry data.

### 2. Analytics
Fleet performance leaderboard with sortable columns, CO2 comparison bar charts, Green Score breakdown visualization, and Speed vs Fuel efficiency scatter plot.

### 3. MRV Ledger
Blockchain-style hash chain timeline, daily CO2 summary by truck, data integrity verification, and one-click CSV/PDF export for auditing.

### 4. Revenue
Interactive carbon credit calculator with adjustable sliders for credit price, fleet compliance rate, and verification costs. Includes monthly/annual projections and PDF report generation.

### 5. AI Chat
Full-screen RAG-powered AI analyst with categorized quick-query buttons, real-time fleet context sidebar, and citation-backed responses.

### 6. Alerts
Live alert feed with severity indicators, alerts-by-type breakdown, affected truck list, and a complete alert rules reference guide.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.12, < 3.14
- **Google Maps API Key** (for live map features)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd "frontend design"
npm install
```

Create a `.env` file in the `frontend design/` directory:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + stats |
| GET | `/fleet_state` | Live fleet telemetry for all trucks |
| GET | `/fleet_summary` | Aggregated fleet statistics |
| GET | `/truck/{id}` | Individual truck details |
| POST | `/trigger_demo` | Trigger demo scenarios |
| POST | `/query` | RAG AI natural language query |
| POST | `/calculate_revenue` | Carbon credit revenue calculation |
| POST | `/generate_report` | PDF verification report |
| GET | `/ledger_stats` | MRV ledger statistics |
| GET | `/export_ledger` | Export ledger as CSV |

---

## Green Score Formula

Each truck receives a score from 0-100 based on:

| Factor | Max Penalty | Calculation |
|--------|------------|-------------|
| Idling | -30 pts | 3 pts per minute idle (engine ON, speed 0) |
| Fuel Excess | -30 pts | 0.6 pts per % above fleet average |
| Route Deviation | -20 pts | 10 pts per km off planned route |
| Low Load | -20 pts | Full penalty below 30% load capacity |

**Badges:** GREEN (80-100) | YELLOW (50-79) | RED (0-49)

---

## CO2 Calculation

Based on IPCC diesel emission factors:

```
CO2 (kg) = fuel_rate_lph × (Δt / 3600) × 2.68
```

Where `2.68 kg CO2/liter` is the standard diesel combustion factor.

---

## License

MIT License

---

<p align="center">
  Built with Pathway, FastAPI, React & Google Maps
</p>
