#!/bin/bash
set -e

echo "=========================================="
echo "Running Integration Tests"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "ERROR: node_modules not found!"
    echo "Please run: npm install"
    exit 1
fi

# Check if backend is running
echo "Checking if backend is available..."
if ! curl -s http://localhost:8000/api/health/ > /dev/null; then
    echo ""
    echo "WARNING: Backend not detected at http://localhost:8000"
    echo "Starting backend in background..."
    
    # Start backend
    cd "$SCRIPT_DIR/../backend"
    if [ ! -d ".venv" ]; then
        echo "ERROR: Backend virtual environment not found!"
        exit 1
    fi
    
    source .venv/bin/activate
    uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/sigilweaver-backend.log 2>&1 &
    BACKEND_PID=$!
    
    # Wait for backend to be ready
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/health/ > /dev/null; then
            echo "Backend ready!"
            break
        fi
        sleep 1
    done
    
    # Cleanup function
    cleanup() {
        echo ""
        echo "Stopping backend..."
        kill $BACKEND_PID 2>/dev/null || true
    }
    trap cleanup EXIT
else
    echo "Backend already running"
fi

# Run integration tests
echo ""
echo "Running integration tests..."
echo "------------------------------------------"
cd "$SCRIPT_DIR/../frontend"
npm run test:integration

echo ""
echo "=========================================="
echo "Integration tests complete!"
echo "=========================================="
