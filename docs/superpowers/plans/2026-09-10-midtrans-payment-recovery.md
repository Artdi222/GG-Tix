# Midtrans payment recovery

Scope: resolve Sandbox settlements remaining pending/expired and returning from the payment browser (GGT-06 / MOB-04). User authorized direct work; unrelated audit findings remain outside this change.

Evidence: two recent orders have matching amounts and settlement responses from the authenticated Sandbox status API, while local rows expired without a webhook payload. Android openBrowserAsync resolves on opening, not on closing. The application has no payment-status reconciliation or return route.

1. Add authenticated Midtrans status retrieval with timeouts, exact order/amount validation, and shared idempotent settlement processing. Never trust browser query parameters as payment confirmation.
2. Reconcile overdue payments before releasing quota. Recover late settlements only with atomic quota reservation; preserve rejected orders and surface paid orders requiring manual review if capacity is unavailable.
3. Add an owned-order status/sync endpoint and a reusable payment session. Preserve the original payment link/expiry, include net discount amounts correctly, and apply configured expiry to new sessions.
4. Add an order payment screen with explicit back/retry/resume actions, bounded polling, AppState/focus refresh and a safe return link. Route pending history/tickets here and prevent duplicate order creation on retry.
5. Test status validation, webhook authentication/idempotency, recovery/stock concurrency, expiry during gateway failures, ownership, and mobile payment lifecycle. Use isolated fixtures, never seed or truncate the user's database.
6. Run backend/mobile type checks and focused lint/build verification; reconcile the two confirmed Sandbox orders with the tested service and verify issued tickets/quota.

Risk: GGT-06 originally treats expired orders as terminal. Recovery needs stock reacquisition because the old sweeper returned quota. If stock cannot be reacquired, retain the terminal order and report payment received / support review instead of overselling. Public webhook configuration still needs a reachable deployment; status synchronization supports local development without exposing the backend publicly.

## Verification

- Backend: 20 passing tests, including isolated PostgreSQL concurrency, duplicate/out-of-order webhooks, identity/amount validation, late settlement stock/voucher recovery, gateway failures, and reusable Snap sessions. Typecheck passed.
- Mobile: 7 passing tests for bounded polling, cancellation, error recovery and platform browser callbacks. Typecheck and lint of changed source files passed.
- Expo Android production bundle exported successfully to `/tmp/ggtix-payment-android` (environment color warnings only).
- Browser fixture checks passed: untrusted success query remains pending, sync displays verified, gateway failure can be retried, back returns to history, no horizontal overflow at 320px, and no runtime page errors. Screenshots: `/tmp/ggtix-payment-pending.png`, `/tmp/ggtix-payment-verified.png`.
- The two confirmed Sandbox orders were reconciled through the tested service: each now verified with one ticket and exactly one unit of stock reacquired.
- No phone was connected through ADB. Native browser dismissal/deep linking still requires a final check in Expo Go on the user's device.
