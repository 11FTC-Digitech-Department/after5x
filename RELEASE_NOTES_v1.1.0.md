# After5 v1.1.0 Release Notes

**Release Date:** May 5, 2026  
**Version Name:** 1.1.0 (release notes target)  
**Version Code:** 23 (Android current project setting)  
**Package:** com.rockit.after5 / com.rockit.after5.experts  
**Distribution:** Internal testing / release candidate

---

## Scope

This release document covers platform and app changes merged from **May 1, 2026 through May 5, 2026**.

Primary focus:
- Self-service account closure (customers and providers) with server-side enforcement and anonymization.
- Login and session handling for closed accounts.
- Promotion story modal usability (close control and layout).
- Minor OAuth/login UI and Supabase config follow-ups shipped alongside the v1.0.7 documentation drop.

---

## iOS Changes

- Some release configurations were updated toward `MARKETING_VERSION = 1.0.7` in `ios/App/App.xcodeproj/project.pbxproj`; other configurations still show mixed marketing versions (for example `1.0.5` / `1.0.0`).
- `CURRENT_PROJECT_VERSION = 3` remains in the project file.
- Before uploading to TestFlight, align all release configurations to the intended **1.1.0** marketing version and bump the build number as needed.

---

## Android Changes

- Current Android project settings remain:
  - `versionName "1.0.6"`
  - `versionCode 23`
- Before Play Console upload, update `versionName` / `versionCode` if this release should ship as **1.1.0**.

---

## App Changes

### Account closure (customers and providers)
- Added **Delete account** flow on customer and provider profile screens with confirmation (user must type `DELETE`).
- New `AccountDeletionService` invokes the `delete-account` Edge Function and surfaces structured errors and **blockers** (for example active bookings, pending invoices, open support tickets, processing payouts, or provider availability).
- Profile and privacy copy updated where relevant for account deletion.
- Database: `profiles` gains `account_status`, closure timestamps, reason, and anonymization metadata; `close_own_account` RPC performs checks, anonymizes identity fields, and signs the user out of the app session path.
- Edge Function `delete-account` validates the JWT, requires confirmation text, calls `close_own_account`, and returns success or blocker payloads.
- **Closed accounts** are blocked by guards (`auth`, `guest`, `initial-route`) and sign-in is rejected on the login page with a clear message; OAuth callback handles closure state; `SessionService` / `app.component` coordinate post-closure behavior.
- Admins cannot self-close from the app (enforced in RPC).
- Admin UI: user and provider lists show account status where applicable.

### Authentication / login UX (follow-up)
- Promotion story modal: full-viewport overlay behavior, spacing, and **larger close control** for accessibility (SSN-254).
- Login template and styles adjusted; small OAuth service tweak and `supabase/config.toml` updates as part of the same integration window.

### Documentation
- Added `RELEASE_NOTES_v1.0.7.md` in-repo (historical notes for the prior drop).

---

## Release Readiness Checklist

### Database and Edge Functions
- [ ] Apply migration `20260504090000_add_account_closure.sql` on the target environment (`supabase db push` or managed pipeline).
- [ ] Deploy the `delete-account` Edge Function and confirm `supabase/config.toml` (or dashboard) exposes it as intended.
- [ ] Smoke-test `close_own_account` with a test user for each role (customer, provider) and verify blockers when bookings/invoices/tickets/payouts apply.

### iOS
- [ ] Align all `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` values before archiving.
- [ ] Run internal customer and experts IPA flows; confirm delete account, re-login blocked for closed users, and admin lists show status.

### Android
- [ ] Align `versionName` and `versionCode` before Play Console upload.
- [ ] Same functional checks as iOS for account closure and closed-account login.

### Shared
- [ ] Regression: normal login, OAuth, biometric login, and role-based routing.
- [ ] Confirm anonymized profiles still satisfy reporting/admin needs without leaking PII.

---

## Known Configuration Notes

- Account deletion requires a live session and valid `Authorization` header on the Edge Function; Capacitor HTTP behavior should match your existing Edge Function auth pattern.
- Blocker messages are returned from the RPC; the app displays them so users know why deletion was denied.

---

## Changelog Reference

### Commits Included (since v1.0.7 / `552d0f9`)
- `679603e` Ssn 254 fix modal pop up header close button (#16)
- `3c75cdf` feat: Implement account closure functionality and enhance user experience (#17)

### Previous Version
- v1.0.7

---

## Store / Tester Notes

### iOS

<en-US>
v1.1.0 (iOS Internal)

- Self-service account deletion for customers and providers, with clear rules when deletion is blocked.
- Closed accounts can no longer sign in; session and guards respect account status.
- Promotion story modal close button and layout improvements.
</en-US>

### Android

<en-US>
v1.1.0 (Android Internal)

- Self-service account deletion for customers and providers, with clear rules when deletion is blocked.
- Closed accounts can no longer sign in; session and guards respect account status.
- Promotion story modal close button and layout improvements.
</en-US>
