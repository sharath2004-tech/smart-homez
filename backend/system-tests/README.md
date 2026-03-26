# Adaptive full-system suite

This suite exercises the booking platform end-to-end by discovering live services and locations, then adapting its flow from API responses instead of hardcoded assumptions.

## What it covers

- Dynamic service discovery across booking/service archetypes
- Customer booking lifecycle per discovered service
- Worker assignment / acceptance behavior
- Admin intervention and manual assignment fallback
- Subscription payment-proof and activation flow
- QR start/end lifecycle for regular bookings when possible
- Real-time sync checks across customer, worker, and admin views
- Latency metrics for assignment and state propagation
- Concurrency scenarios:
  - multiple customers booking the same slot
  - multiple workers racing to accept the same job
  - admin override during active assignment flow
- Failure / recovery scenarios and rollback observations
- Optional internal scheduler hooks for recurring generation and auto-renewal

## Run

From `backend/`:

- `node system-tests/runAdaptiveSystemSuite.js`
- or use the npm script added in `backend/package.json`

## Configuration

Edit `backend/system-tests/.env` before running.

Required:

- `SYSTEM_TEST_API_BASE_URL`
- `SYSTEM_TEST_ADMIN_EMAIL`
- `SYSTEM_TEST_ADMIN_PASSWORD`
- `SYSTEM_TEST_WORKERS_JSON`

Optional:

- `SYSTEM_TEST_SUPER_ADMIN_EMAIL`
- `SYSTEM_TEST_SUPER_ADMIN_PASSWORD`
- `SYSTEM_TEST_ENABLE_INTERNAL_JOBS=true`
- `MONGODB_URI` when internal scheduler hooks are enabled

## Output

The suite writes:

- detailed JSON report with per-test objects
- summary dashboard JSON
- markdown summary

under the configured `SYSTEM_TEST_OUTPUT_DIR`.

## Notes

- The suite creates temporary customers with unique emails.
- It does **not** assume a single booking workflow for all services.
- If an edge case cannot be triggered through public APIs, the suite records that explicitly and optionally uses internal scheduler hooks when enabled.
