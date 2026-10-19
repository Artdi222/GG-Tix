#!/usr/bin/env bash
# Black-box API tests against a throwaway database and server.
# Usage: bun run test:api   (needs the ggtix_postgres container running)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${TEST_API_PORT:-3998}"

# A low login limit keeps the rate-limit test fast.
RATE_LIMIT_AUTH_MAX=40 TEST_API_PORT="$PORT" bash scripts/test-server.sh >/tmp/ggtix-test-api.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 150); do curl -sf "http://localhost:$PORT/api/health" >/dev/null && break; sleep 0.2; done

API_TEST_URL="http://localhost:$PORT/api" bun test tests/api.test.ts
