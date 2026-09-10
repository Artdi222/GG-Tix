# Push notification setup

Implemented: customer-owned device registration/opt-out, durable deduplicated jobs for payment confirmation, H-1 event reminder and newly published events; worker leases, bounded retries and Expo receipt checks. No notifications contain QR values, names, email addresses, or transaction amounts. Tap targets are validated against the signed-in customer.

Remote delivery is disabled until `EXPO_PUSH_ENABLED=true` is set on the backend. Enabling requires a configured Expo project and a development/production build. Expo Go on Android cannot receive remote push. The application explains this and remains usable.

## Deployment setup

1. Link this mobile project to your existing EAS project, or create one using `eas init`. Set `EXPO_PUBLIC_EAS_PROJECT_ID` in the mobile environment to the returned project UUID. No secret goes in an `EXPO_PUBLIC_` variable.
2. Configure Android FCM v1 credentials with EAS and provide `GOOGLE_SERVICES_JSON` as a build-time file path. Configure APNs credentials for iOS. The app identifiers default to `com.ggtix.mobile` and can be overridden with `EXPO_ANDROID_PACKAGE` / `EXPO_IOS_BUNDLE_IDENTIFIER`.
3. Build: `eas build --profile development --platform android`; install the result, then `bunx expo start --dev-client --lan`. Regular Expo Go testing: `bunx expo start --go --lan`.
4. Run backend migrations (`bun run db:migrate`), set `EXPO_PUSH_ENABLED=true`, and restart backend. If enhanced Expo push security is enabled, set `EXPO_ACCESS_TOKEN` only in backend secrets.
5. In mobile Profile, explicitly enable notifications and accept the OS permission. A one-minute worker queues deliveries; receipt checks start after 15 minutes. `accepted` means Expo accepted the request; `delivered` means Expo reported provider acceptance, not proof the person read it.
6. Exercise a Sandbox payment, an owned event within 24 hours, and a newly created open event; inspect delivery state in `notification_jobs`. Disable notifications and verify no additional deliveries are sent. Test account switching and tapping a notification after logout.

## Operational boundaries

Existing historical payments/events are not announced on first opt-in. Unused upcoming tickets receive one H-1 reminder per order/device. Failed/unknown jobs remain inspectable. Queue retry is at-least-once because the external provider has no idempotency key; an ambiguous transport timeout can cause a repeated push. Logouts with active push registration require connectivity to revoke the device before closing the session. The confirmation screen remains the source of truth for payment state.

The implementation is verified using mocked Expo send/receipt responses. Real device delivery still requires the EAS/FCM/APNs setup above; it has not been represented as live-tested.
