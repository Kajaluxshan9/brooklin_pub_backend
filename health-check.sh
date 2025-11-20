# ========================================
# Backend Health Check Script
# ========================================

#!/bin/bash

BACKEND_URL="${1:-http://localhost:5000}"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "Checking backend health at $BACKEND_URL/health"

for i in $(seq 1 $MAX_RETRIES); do
    echo "Attempt $i/$MAX_RETRIES..."
    
    response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo "✓ Backend is healthy!"
        echo "$body" | jq . 2>/dev/null || echo "$body"
        exit 0
    fi
    
    if [ $i -lt $MAX_RETRIES ]; then
        sleep $RETRY_INTERVAL
    fi
done

echo "✗ Backend health check failed after $MAX_RETRIES attempts"
exit 1
