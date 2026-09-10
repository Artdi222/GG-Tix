# GG Tix implementation audit — 10 September 2026

Source: `.project-context/prd/GG Tix - Dokumen Konsep Lengkap.md` and applicable GGT-06, GGT-09, GGT-10, GGT-11 contracts. No separate BRD or PRD index was present. Project context documents were not edited.

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Midtrans success left mobile pending and browser difficult to leave | Dedicated payment screen, native browser return handling, bounded status sync, reusable Snap sessions, late-settlement reconciliation | Payment service integration tests and mobile browser/poller tests; two previously paid Sandbox orders reconciled in earlier work |
| Promo validation payload and response mismatched | Send code/event/category/quantity; consume flat server amounts and voucher code | Browser fixture verifies request shape and renders returned discount |
| Fully discounted checkout could not open payment | Zero-total order verifies and issues tickets in the quota transaction, without Midtrans | Integration test validates voucher usage and real generated ticket rows |
| Mobile refresh token unused | Single-flight refresh, retry once, terminal invalidation, stale-response guards | Concurrent request, network failure, bad login, and logout-during-refresh tests |
| Offline ticket cache crossed account boundaries | Per-user cache, legacy purge, serialized writes/cleanup, network-only fallback, keyed ticket/payment screens | Session tests; browser confirms offline QR works and HTTP 403 never displays cached QR |
| Orders truncated at ten, counters counted orders as tickets | Server status filtering, pagination metadata, full-account summary, active unused future tickets counted individually | 25-order integration and browser fixtures, active ticket/check-in regression |
| Catalog pagination omitted | Load all public catalog pages before local city/genre counts and filtering | Pagination contract tests |
| Profile name/email editing unavailable | Edit form wired to authenticated profile endpoint; response excludes password hash | Browser save fixture and type checks |
| Settings persisted without effect | Global ticket default with nullable event override, maintenance rejects new checkout, configured expiry used, public support contacts connected | Transaction tests; migration preserves existing explicit event limits |
| Diagnostics overstated external connectivity | Distinguish configured credentials from a tested healthy connection | Admin UI labels configured/unverified explicitly |
| Admin API errors displayed invented data | Removed dashboard, event, artist and ticket fallback fixtures; error/retry states; removed third-party QR fallback | Production build and source review |
| Notifications were no-ops | Device registration/opt-out, durable deduplicated jobs, H-1/new-event/payment scheduler, Expo sends and receipt checks, retry leases | Mocked gateway integration tests including reassignment and opt-out |
| Concurrent verification/QR scans could duplicate transitions | Order/ticket row locks and atomic quota refunds | Concurrent integration tests |

## External setup still required

Remote push delivery requires EAS project configuration, FCM/APNs credentials and a development/production build. No configured EAS project was supplied during this task. Delivery stays disabled via `EXPO_PUSH_ENABLED` until deployment setup is complete. See `../superpowers/plans/2026-09-10-push-setup.md`. Expo Go remains supported for the rest of the application.

Real device payment return behavior still needs a final user check on the physical phone; browser/native API tests and an Android bundle cannot substitute for that device check. No attached ADB device was available.

## Validation

- Backend: 28 tests pass in an isolated PostgreSQL schema, including gateway, settings, promotion, pagination, queue and check-in regressions.
- Mobile: 17 tests pass for payment, HTTP refresh, cache isolation and pagination.
- Backend/mobile TypeScript checks and frontend Nuxt typecheck pass.
- Android export and Nuxt production build pass. Toolchain emits pre-existing color/plugin/import warnings.
- Browser fixtures pass: order page two, profile editing/saving, promo request/response, offline ticket, access-denied cache rejection; no page errors. Admin browser check confirms the dashboard displays the API failure and does not substitute fabricated event data.
- Focused mobile ESLint passes. Admin frontend has existing lint debt: before this work, the six touched Vue files already had 228 errors; current error count is 227 (warnings decreased from 281 to 280). This is not reported as a clean frontend lint run.
- Database migration 0006 applied; existing customer orders were not seeded/truncated. Integration fixtures use a disposable schema.
- Work remains local and uncommitted.
