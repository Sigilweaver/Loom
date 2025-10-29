#!/bin/bash
set -e

echo "=========================================="
echo "Running All Tests (Backend + Frontend)"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Track failures
BACKEND_FAILED=0
FRONTEND_FAILED=0

# Run backend tests
echo ""
echo "Phase 1/2: Backend Tests"
echo "=========================================="
if ! "$SCRIPT_DIR/test_backend.sh"; then
    BACKEND_FAILED=1
    echo "Backend tests failed!"
fi

# Run frontend tests
echo ""
echo ""
echo "Phase 2/2: Frontend Tests"
echo "=========================================="
if ! "$SCRIPT_DIR/test_frontend.sh"; then
    FRONTEND_FAILED=1
    echo "Frontend tests failed!"
fi

# Summary
echo ""
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="

if [ $BACKEND_FAILED -eq 0 ] && [ $FRONTEND_FAILED -eq 0 ]; then
    echo "All tests passed!"
    exit 0
else
    if [ $BACKEND_FAILED -eq 1 ]; then
        echo "Backend tests failed"
    else
        echo "Backend tests passed"
    fi
    
    if [ $FRONTEND_FAILED -eq 1 ]; then
        echo "Frontend tests failed"
    else
        echo "Frontend tests passed"
    fi
    
    echo ""
    exit 1
fi
