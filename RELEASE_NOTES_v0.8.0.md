# After5 v0.8.0 Release Notes (Internal Testing)

**Release Date:** February 27, 2026  
**Version Name:** 0.8.0  
**Version Code:** 13 (Android)  
**Package:** com.rockit.after5  
**Distribution:** Internal testing only - not for public release

---

## Internal Testing

This build is intended for **internal QA and stakeholder testing** only. Please report issues, UX feedback, and device-specific behavior through the team's chosen channel (e.g. Slack, Linear, or internal tracker).

### Scope of This Release
- Version/package alignment update for `0.8.0` (`Android versionCode 13`, `iOS MARKETING_VERSION 0.8.0`).
- Functional scope validated from commits merged after the previous internal cycle (voucher, chat/notifications, admin tooling, local-dev and reliability updates).

### Focus Areas for Testers
- [ ] Voucher redemption/removal during payment (`AFTER5LAUNCH` and invalid/expired codes)
- [ ] End-to-end booking flow (create -> pay -> status updates)
- [ ] Chat unread badges and foreground chat notifications (customer + provider)
- [ ] SYSTEM chat messages on booking status transitions
- [ ] Provider job execution and real-time updates
- [ ] Notifications and deep links
- [ ] Admin tab visibility and page loading (dashboard/users/providers/services/bookings)
- [ ] Regression checks vs v0.7.0 on login/profile/wallet/address flows

---

## What's New (since last release)

### Customer
- Added voucher support in payment flow.
- Apply/remove voucher from payment page with discount preview and updated totals.
- Added user-friendly validation feedback for invalid, expired, or ineligible voucher states.
- Home page promotions now support dynamic offers loaded from backend, including voucher metadata.
- Booking details flow improved to reduce noisy status feedback and toast messages.

### Provider
- Improved real-time chat and notification behavior in provider tabs and job execution context.
- Better unread chat badge updates and notification handling during active sessions.

### Technical
- Added SYSTEM chat message type with DB migration support and UI rendering updates.
- Push notification pipeline improvements.
- Chat notification trigger fixes in SQL migration.
- Queue cleanup migration for processed/failed push notifications older than 7 days.
- Reliability and observability improvements.
- `devLog` integration to standardize non-production logging.
- Added global error handler + HTTP error interceptor for centralized error management.
- iOS privacy permission descriptions updated (`camera`, `photo library`, `location`, `Face ID`) in `Info.plist`.
- Added/expanded admin domain surface (dashboard/users/providers/services/bookings pages).
- Local development workflow improvements.
- Android build script support for `local` and `local-ngrok` environments.
- `adb reverse` flow and ngrok helper improvements.
- Supabase service updates for ngrok/local connectivity.
- Android artifact packaging improvements.
- APK/AAB existence checks, deterministic rename, zip output, and move to `~/Downloads`.
- Version updates in this release candidate.
- Android bumped `0.7.0 (12)` -> `0.8.0 (13)`.
- iOS `MARKETING_VERSION` bumped `0.7.0` -> `0.8.0`.
- Default local Supabase endpoint set to `http://127.0.0.1:54321/` in development environment file.

---

## Bug Fixes
- Fixed chat notification trigger behavior to improve delivery consistency.
- Improved voucher redemption error mapping and end-user messaging.
- Reduced duplicate/non-actionable booking status toasts.
- Hardened Android release artifact handling with file existence checks and safer output paths.

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 0.8.0        | 13           | 24      | 36         |
| iOS      | 0.8.0        | 3            | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key (`android/keystore.properties` required)
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Artifacts

- **Android Bundle:** `android/app/build/outputs/bundle/customerRelease/app-customer-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/customerRelease/mapping.txt`
- **iOS:** Build via Xcode or CI; ensure `MARKETING_VERSION=0.8.0` and `CURRENT_PROJECT_VERSION=3`

---

## Changelog Reference

### Commits Included
- `737fb55` - Release 0.7.0: devLog integration, iOS permission updates, broad reliability/admin updates.
- `3e4a827` - Voucher code system (redeem/remove functions, payment UX, offers integration, migrations).
- `c0255eb` - Version update to 0.7.0 baseline (Android/iOS).
- `ccdd53d` - Push notification queue cleanup SQL migration.
- `aac1ba9` - SYSTEM chat message type and chat/notification enhancements.
- `1f714d4` - Service caching improvements and added unit tests.
- `2c33121` - Android local/local-ngrok build flow and Supabase local-dev updates.
- `bdc70b1` - Chat push-notification handling and badge updates.
- `e21467e` - Android bundle checks, rename, and move to Downloads.
- `ae7f87b` - Android APK renaming/zipping and improved build output handling.
- Uncommitted release-prep updates in working tree.
- Android set to `versionName 0.8.0`, `versionCode 13`.
- iOS `MARKETING_VERSION` set to `0.8.0`.
- Local dev Supabase URL default updated to `127.0.0.1:54321`.

### Previous Version
- v0.7.0

---

## Google Play Internal Testing Notes

> For internal testing track upload only. Store listing and release notes are not required for internal testers.

<en-US>
v0.8.0 (Internal)

- Added voucher code redemption/removal flow with dynamic offer support.
- Improved chat and push notification reliability, including SYSTEM chat messages.
- Added reliability enhancements (global error handling/interceptor, dev logging).
- Includes internal tooling/build updates and version bump to 0.8.0.
</en-US>
