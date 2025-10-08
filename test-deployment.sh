#!/bin/bash

# Deployment Validation Test Suite
# Tests production build, server startup, health checks, and asset serving

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results array
declare -a TEST_RESULTS=()

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TEST_RESULTS+=("PASS: $1")
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    TEST_RESULTS+=("FAIL: $1")
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    TEST_RESULTS+=("WARN: $1")
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test server..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Test 1: Verify build artifacts exist
test_build_artifacts() {
    log_info "Testing build artifacts..."

    if [ -f "dist/index.js" ]; then
        SIZE=$(du -h dist/index.js | cut -f1)
        log_success "Backend bundle exists (size: $SIZE)"
    else
        log_error "Backend bundle not found at dist/index.js"
        return 1
    fi

    if [ -d "dist/public" ]; then
        log_success "Frontend build directory exists"
    else
        log_error "Frontend build directory not found at dist/public"
        return 1
    fi

    if [ -f "dist/public/index.html" ]; then
        log_success "Frontend index.html exists"
    else
        log_error "Frontend index.html not found"
        return 1
    fi

    if [ -d "dist/public/assets" ]; then
        ASSET_COUNT=$(find dist/public/assets -type f | wc -l)
        log_success "Frontend assets directory exists ($ASSET_COUNT files)"
    else
        log_error "Frontend assets directory not found"
        return 1
    fi
}

# Test 2: Start production server
test_server_startup() {
    log_info "Starting production server..."

    # Set test environment variables
    export NODE_ENV=production
    export PORT=3333
    export DATABASE_URL="${DATABASE_URL:-postgresql://localhost:5432/rfpagent_test?sslmode=disable}"

    # Start server in background
    node dist/index.js > server.log 2>&1 &
    SERVER_PID=$!

    log_info "Server started with PID $SERVER_PID"

    # Wait for server to start (max 30 seconds)
    log_info "Waiting for server to become ready..."
    for i in {1..30}; do
        if curl -s http://localhost:3333/api/health/live > /dev/null 2>&1; then
            log_success "Server started successfully on port 3333"
            return 0
        fi
        sleep 1
    done

    log_error "Server failed to start within 30 seconds"
    log_info "Server logs:"
    cat server.log
    return 1
}

# Test 3: Test health endpoints
test_health_endpoints() {
    log_info "Testing health check endpoints..."

    # Test liveness probe
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/health/live)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "Liveness endpoint returned 200"
    else
        log_error "Liveness endpoint returned $HTTP_CODE (expected 200)"
    fi

    # Test quick health check
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/health)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "Quick health check endpoint returned 200"
    else
        log_error "Quick health check endpoint returned $HTTP_CODE (expected 200)"
    fi

    # Test detailed health check
    HEALTH_RESPONSE=$(curl -s http://localhost:3333/api/health/detailed)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/health/detailed)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
        log_success "Detailed health check endpoint accessible (status: $HTTP_CODE)"

        # Parse response
        STATUS=$(echo $HEALTH_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        log_info "System health status: $STATUS"
    else
        log_error "Detailed health check endpoint returned unexpected code: $HTTP_CODE"
    fi

    # Test readiness probe
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/health/ready)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
        log_success "Readiness endpoint accessible (status: $HTTP_CODE)"
    else
        log_error "Readiness endpoint returned unexpected code: $HTTP_CODE"
    fi
}

# Test 4: Test static asset serving
test_static_assets() {
    log_info "Testing static asset serving..."

    # Test index.html
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/)
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "Root path serves index.html (200)"
    else
        log_error "Root path returned $HTTP_CODE (expected 200)"
    fi

    # Test that HTML contains expected content
    CONTENT=$(curl -s http://localhost:3333/)
    if echo "$CONTENT" | grep -q "<!DOCTYPE html>"; then
        log_success "Response contains valid HTML"
    else
        log_error "Response does not contain valid HTML"
    fi

    # Test asset loading (check if CSS and JS files are referenced)
    if echo "$CONTENT" | grep -q "\.css"; then
        log_success "HTML references CSS assets"
    else
        log_warning "HTML does not reference CSS assets"
    fi

    if echo "$CONTENT" | grep -q "\.js"; then
        log_success "HTML references JavaScript assets"
    else
        log_warning "HTML does not reference JavaScript assets"
    fi
}

# Test 5: Test API endpoints
test_api_endpoints() {
    log_info "Testing API endpoints..."

    # Test a known API endpoint (should return 401 for unauthenticated)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/portals)
    if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
        log_success "API endpoint accessible (returned $HTTP_CODE)"
    else
        log_warning "API endpoint returned unexpected code: $HTTP_CODE"
    fi
}

# Test 6: Check for runtime errors
test_runtime_errors() {
    log_info "Checking for runtime errors in server logs..."

    if grep -qi "error" server.log && ! grep -qi "0 errors" server.log; then
        log_warning "Server logs contain errors (see server.log for details)"
        log_info "Error lines:"
        grep -i "error" server.log | head -5
    else
        log_success "No critical errors found in server logs"
    fi

    if grep -qi "unhandled" server.log; then
        log_error "Server logs contain unhandled errors"
        grep -i "unhandled" server.log
    else
        log_success "No unhandled errors detected"
    fi
}

# Test 7: Test database connectivity
test_database_connectivity() {
    log_info "Testing database connectivity..."

    HEALTH_RESPONSE=$(curl -s http://localhost:3333/api/health/detailed)

    DB_STATUS=$(echo $HEALTH_RESPONSE | grep -o '"database":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

    if [ "$DB_STATUS" = "up" ]; then
        log_success "Database connection is healthy"
    elif [ "$DB_STATUS" = "degraded" ]; then
        log_warning "Database connection is degraded"
    elif [ "$DB_STATUS" = "down" ]; then
        log_error "Database connection is down"
    else
        log_warning "Database status unknown: $DB_STATUS"
    fi
}

# Test 8: Performance metrics
test_performance() {
    log_info "Testing performance metrics..."

    # Test response time
    START=$(date +%s%N)
    curl -s http://localhost:3333/api/health/live > /dev/null
    END=$(date +%s%N)
    RESPONSE_TIME=$(( (END - START) / 1000000 ))

    if [ $RESPONSE_TIME -lt 100 ]; then
        log_success "Health check response time: ${RESPONSE_TIME}ms (excellent)"
    elif [ $RESPONSE_TIME -lt 500 ]; then
        log_success "Health check response time: ${RESPONSE_TIME}ms (good)"
    else
        log_warning "Health check response time: ${RESPONSE_TIME}ms (slow)"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "  DEPLOYMENT VALIDATION TEST SUITE"
    echo "=========================================="
    echo ""

    log_info "Starting deployment validation tests..."
    echo ""

    # Run all tests
    test_build_artifacts || true
    echo ""

    test_server_startup || {
        log_error "Server startup failed - cannot continue with remaining tests"
        print_summary
        exit 1
    }
    echo ""

    # Give server a moment to fully initialize
    sleep 2

    test_health_endpoints || true
    echo ""

    test_database_connectivity || true
    echo ""

    test_static_assets || true
    echo ""

    test_api_endpoints || true
    echo ""

    test_runtime_errors || true
    echo ""

    test_performance || true
    echo ""

    print_summary
}

print_summary() {
    echo ""
    echo "=========================================="
    echo "  TEST SUMMARY"
    echo "=========================================="

    PASS_COUNT=0
    FAIL_COUNT=0
    WARN_COUNT=0

    for result in "${TEST_RESULTS[@]}"; do
        echo "$result"
        if [[ $result == PASS:* ]]; then
            ((PASS_COUNT++))
        elif [[ $result == FAIL:* ]]; then
            ((FAIL_COUNT++))
        elif [[ $result == WARN:* ]]; then
            ((WARN_COUNT++))
        fi
    done

    echo ""
    echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
    echo -e "${YELLOW}Warnings: $WARN_COUNT${NC}"
    echo -e "${RED}Failed: $FAIL_COUNT${NC}"
    echo ""

    if [ $FAIL_COUNT -eq 0 ]; then
        echo -e "${GREEN}✓ All critical tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed - see details above${NC}"
        exit 1
    fi
}

# Run main function
main
