#!/bin/bash
# Runs every browser test against a separate copy of the app on a throwaway
# database, with stand-ins for the WhatsApp sender and the email service.
# Real gyms, real WhatsApp numbers and real email are never touched.
#
#   npm run test:e2e            (needs Docker Postgres from DEPLOY.md and Google Chrome)
#   TEST_DATABASE_URL=... npm run test:e2e   (any empty Postgres database; used by CI)
#   HEADED=1 npm run test:e2e   (watch the browser)
set -uo pipefail
cd "$(dirname "$0")/.."

DB_URL="${TEST_DATABASE_URL:-postgresql://postgres:gym@localhost:5433/gym_e2e}"
APP_PORT=3100
export BASE="http://localhost:$APP_PORT"
export SUPERADMIN_LOGIN=admin
export SUPERADMIN_PASSWORD="e2e-admin-password"

cleanup() {
  for pid in ${PIDS:-}; do kill "$pid" 2>/dev/null; done
}
trap cleanup EXIT

echo "→ fresh test database"
# Locally the database lives in the gym-management-db container; in CI it is a
# Postgres service that already has the gym_e2e database.
docker exec gym-management-db psql -U postgres -c "CREATE DATABASE gym_e2e" >/dev/null 2>&1 || true
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx prisma db push --force-reset --accept-data-loss --skip-generate >/dev/null || exit 1

echo "→ production build"
NODE_OPTIONS=--no-experimental-webstorage npx next build >/tmp/gym-e2e-build.log 2>&1 || { tail -30 /tmp/gym-e2e-build.log; exit 1; }

rm -f tests/e2e/emails.jsonl
node tests/e2e/stand-in-sender.mjs & PIDS="$!"
node tests/e2e/mock-email.mjs & PIDS="$PIDS $!"
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  SESSION_SECRET="e2e-session-secret-at-least-32-characters" \
  WHATSAPP_WORKER_URL=http://localhost:3201 WHATSAPP_WORKER_KEY=test CRON_SECRET=test \
  RESEND_API_KEY=test EMAIL_FROM=billing@example.com RESEND_API_URL=http://localhost:3300/emails \
  NODE_OPTIONS=--no-experimental-webstorage npx next start -p $APP_PORT >/tmp/gym-e2e-app.log 2>&1 & PIDS="$PIDS $!"
for _ in $(seq 1 40); do curl -s -o /dev/null "$BASE/signin" && break; sleep 1; done

failed=0
for suite in multi-gym onboarding daily-flows features front-desk; do
  node "tests/e2e/$suite.test.mjs" || failed=$((failed + 1))
done
echo "Screenshots of failures, if any: tests/e2e/screenshots/"
[ $failed -eq 0 ] && echo "ALL SUITES PASSED" || echo "$failed SUITE(S) FAILED"
exit $failed
