#!/bin/bash
# CarbonRoute AI - Start Script
# Usage: bash start.sh

set -e

echo "============================================"
echo "  CarbonRoute AI - Smart Green Logistics"
echo "  Starting all services..."
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo -e "${GREEN}Virtual environment activated${NC}"
else
    echo -e "${YELLOW}No venv found. Creating one...${NC}"
    python3.13 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    echo -e "${GREEN}Virtual environment created and dependencies installed${NC}"
fi

echo ""
echo -e "${GREEN}Starting Backend API (port 8000)...${NC}"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!
echo "  API PID: $API_PID"

# Wait for API to start
sleep 3

echo -e "${GREEN}Starting Fleet Simulator...${NC}"
python simulator.py &
SIM_PID=$!
echo "  Simulator PID: $SIM_PID"

echo ""
echo "============================================"
echo -e "${GREEN}  All services started!${NC}"
echo ""
echo "  API:        http://localhost:8000"
echo "  API Docs:   http://localhost:8000/docs"
echo "  Frontend:   cd '../frontend design' && npm run dev"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "============================================"

# Trap Ctrl+C to kill all background processes
trap "echo ''; echo 'Shutting down...'; kill $API_PID $SIM_PID 2>/dev/null; exit 0" INT TERM

# Wait for any background process to finish
wait
