#!/bin/bash

# Sigilweaver Development Script
# Runs both the Python backend and Electron frontend concurrently

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Sigilweaver Development Launcher${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if backend virtual environment exists
if [ ! -d "sigilweaver-backend/.venv" ]; then
    echo -e "${RED}ERROR: Backend virtual environment not found!${NC}"
    echo -e "${YELLOW}Please set up the backend first:${NC}"
    echo "  cd sigilweaver-backend"
    echo "  python -m venv .venv"
    echo "  source .venv/bin/activate"
    echo "  pip install -e \".[dev]\""
    exit 1
fi

# Check if frontend node_modules exists
if [ ! -d "sigilweaver-frontend/node_modules" ]; then
    echo -e "${RED}ERROR: Frontend dependencies not installed!${NC}"
    echo -e "${YELLOW}Please set up the frontend first:${NC}"
    echo "  cd sigilweaver-frontend"
    echo "  npm install"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill 0  # Kill all processes in the current process group
    wait
    echo -e "${GREEN}All services stopped${NC}"
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
echo -e "${GREEN}Starting Python backend...${NC}"
cd sigilweaver-backend
(
    source .venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1 | sed "s/^/[BACKEND] /"
) &
BACKEND_PID=$!
cd ..

# Give backend a moment to start
sleep 2

# Start frontend (Vite dev server)
echo -e "${GREEN}Starting Vite dev server...${NC}"
cd sigilweaver-frontend
(
    npm run dev 2>&1 | sed "s/^/[FRONTEND] /"
) &
FRONTEND_PID=$!
cd ..

# Wait a bit for Vite to start
sleep 3

# Optionally start Electron (uncomment if you want Electron to auto-launch)
# echo -e "${GREEN}Starting Electron...${NC}"
# cd sigilweaver-frontend
# (
#     npm run electron 2>&1 | sed "s/^/[ELECTRON] /"
# ) &
# ELECTRON_PID=$!
# cd ..

echo ""
echo -e "${GREEN}Services started!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Backend API:    ${GREEN}http://localhost:8000${NC}"
echo -e "API Docs:       ${GREEN}http://localhost:8000/docs${NC}"
echo -e "Frontend:       ${GREEN}http://localhost:5173${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}To launch Electron, run in another terminal:${NC}"
echo -e "   cd sigilweaver-frontend && npm run electron"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background processes
wait
