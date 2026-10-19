#!/usr/bin/env bash
# Reset the disposable test database (migrate + seed) and serve the API on it.
# Used by `bun run test:api` and the frontend Playwright e2e suite.
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
TEST_URL="${TEST_API_DATABASE_URL:-${DEV_URL%/*}/ggtix_test}"
DB_NAME="${TEST_URL##*/}"

# Safety: this script truncates and reseeds the target database.
[[ "$DB_NAME" == *_test ]] || { echo "Refusing to run: database '$DB_NAME' does not end in _test" >&2; exit 1; }

docker exec ggtix_postgres psql -U ggtix -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || docker exec ggtix_postgres createdb -U ggtix "$DB_NAME"

DATABASE_URL="$TEST_URL" bunx drizzle-kit migrate >/dev/null
DATABASE_URL="$TEST_URL" bun run src/db/seed.ts >/dev/null
docker exec ggtix_postgres psql -U ggtix -d "$DB_NAME" -qc "TRUNCATE rate_limits"

exec env DATABASE_URL="$TEST_URL" PORT="${TEST_API_PORT:-3998}" RATE_LIMIT_AUTH_MAX="${RATE_LIMIT_AUTH_MAX:-200}" bun src/index.ts
