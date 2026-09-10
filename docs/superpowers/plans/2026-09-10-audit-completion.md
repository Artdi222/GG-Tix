# GG Tix audit completion

Authorized by the user's instruction to complete all audit findings. Existing Midtrans recovery stays in place.

## Design and sequence

1. Align mobile voucher validation with the server contract; trust server totals.
2. Centralize session persistence and single-flight token refresh. Reject stale responses after logout/account changes. Scope offline caches to the authenticated customer; only use them for network failures.
3. Preserve order pagination and provide full-account counters. Refresh on focus, paginate each server-side status filter, expose retry states.
4. Apply global settings to checkout with explicit per-event overrides, maintenance enforcement, and public support contacts. Preserve existing event overrides during migration.
5. Remove fabricated admin dashboard and ticket fallbacks; display errors and retries with real API data.
6. Implement opt-in Expo push registration, durable delivery queue, confirmation/reminder/new-event notifications, retry and receipt handling. Expo Go remains usable; remote push requires EAS configuration and a development build.
7. Complete profile editing and regression checks. Review authorization, cross-account data boundaries, concurrency, quota and notification deduplication.

## Verification

Portable tests for session refresh and stale requests, pagination and voucher contracts. Backend integration tests in an isolated schema, including settings, ticket creation, and notification deduplication. Backend/mobile/frontend type checks, relevant lint, Android bundle, and browser checks for failure recovery and account separation. Do not seed or truncate existing customer data; do not fabricate successful external delivery.
