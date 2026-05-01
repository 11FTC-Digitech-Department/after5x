# After5 v1.0.7 Release Notes

**Release Date:** April 30, 2026  
**Version Name:** 1.0.7 (release notes target)  
**Version Code:** 23 (Android current project setting)  
**Package:** com.rockit.after5 / com.rockit.after5.experts  
**Distribution:** Internal testing / release candidate

---

## Scope

This release document covers platform and app changes merged from **April 24, 2026 through April 30, 2026**.

Primary focus:
- iOS customer and experts build preparation.
- Android dependency/runtime alignment from shared Capacitor updates.
- Social login expansion with Apple OAuth.
- Release housekeeping for generated iOS artifacts.

---

## iOS Changes

### Customer App
- Added shared Xcode scheme support for customer builds via `AppCustomer`.
- Added iOS build automation for sync, archive, and IPA export.
- Added App Store export options plist for TestFlight/App Store style exports.
- Updated customer Firebase iOS configuration under `ios/App/Firebase/customer/GoogleService-Info.plist`.
- Reworked iOS splash assets to use universal `Default@1x`, `Default@2x`, and `Default@3x` launch images.
- Updated customer app icon asset metadata and source image.
- Updated Capacitor iOS Swift Package resolution and package reference.

### Experts App
- Added shared Xcode scheme support for experts builds via `AppExperts`.
- Added experts bundle identifier support: `com.rockit.after5.experts`.
- Added experts URL scheme support: `after5experts`.
- Added experts Firebase iOS configuration under `ios/App/Firebase/experts/GoogleService-Info.plist`.
- Added dedicated experts app icon asset set: `AppIconExperts.appiconset`.
- Added experts build support to `scripts/ios-build.sh`:
  - `npm run ios:archive:experts`
  - `npm run ios:bundle:experts`

### iOS Build Housekeeping
- Stopped tracking generated iOS build artifacts.
- Added `ios/SourcePackages/` to `.gitignore`.
- Current iOS project state has mixed marketing versions across configurations:
  - Some customer configurations show `MARKETING_VERSION = 1.0.5`.
  - Several customer/experts configurations show `MARKETING_VERSION = 1.0.0`.
  - `CURRENT_PROJECT_VERSION = 3`.
- Before uploading to TestFlight, align all release configurations to the intended version/build number.

---

## Android Changes

- Shared Capacitor runtime updates apply to Android builds:
  - `@capacitor/core` updated from `8.0.0` to `^8.3.1`.
  - `@capacitor/ios` updated from `8.0.0` to `^8.3.1`.
  - `@capacitor/cli` updated from `8.0.0` to `^8.3.1`.
- Existing Android build scripts remain available for both customer and experts variants:
  - `npm run android:bundle:customer`
  - `npm run android:bundle:experts`
  - `npm run android:bundle:all`
- Current Android project setting remains:
  - `versionName "1.0.6"`
  - `versionCode 23`
- Before Play Console upload, update Android `versionName`/`versionCode` if this release should ship as `1.0.7`.

---

## App Changes

### Authentication
- Added Apple OAuth provider support alongside Google and Facebook.
- Added "Continue with Apple" button on the customer login screen.
- Added Apple loading state and provider dispatch in the shared OAuth login flow.
- Enabled Apple in Supabase local config using env-based credentials:
  - `APPLE_CLIENT_ID`
  - `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`

### Login / UX
- Ensured the login page defaults to the customer app mode where needed.
- Refined promotion story modal styling.

---

## Release Readiness Checklist

### iOS
- [ ] Confirm Apple Developer Sign in with Apple configuration uses the correct OAuth Services ID when testing browser-based Supabase OAuth.
- [ ] Confirm Apple return URL is registered:
  - `https://zqdnzbchifwwtyyjrmzx.supabase.co/auth/v1/callback`
- [ ] Confirm Supabase Apple provider secret JWT is current.
- [ ] Align all iOS `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` values before archiving.
- [ ] Run `npm run ios:bundle:customer` for customer IPA.
- [ ] Run `npm run ios:bundle:experts` for experts IPA.
- [ ] Verify the correct Firebase plist is copied/used for each flavor.
- [ ] Verify customer and experts app icons render correctly on device.

### Android
- [ ] Align `versionName` and `versionCode` before Play Console upload.
- [ ] Run `npm run android:bundle:customer`.
- [ ] Run `npm run android:bundle:experts`.
- [ ] Verify Apple OAuth button is hidden/shown only in the intended customer login flow.
- [ ] Regression test Google/Facebook OAuth after adding Apple.

### Shared
- [ ] Verify OAuth redirects on live Supabase, not local Supabase, when testing production builds.
- [ ] Confirm login, signup, biometric login, and role-based post-auth navigation.
- [ ] Test customer and experts builds on physical iOS and Android devices.

---

## Known Configuration Notes

- Supabase Edge Function env files do not enable OAuth providers. Apple provider settings must be configured in Supabase Auth provider settings for live, or in `supabase/config.toml` plus local Supabase env for local development.
- For browser-based Supabase Apple OAuth, Apple usually expects a Services ID as the OAuth client ID. Bundle IDs are for native app identity and may fail with `invalid_request: Invalid client id or web redirect url`.
- The local app default environment points to `http://127.0.0.1:54321`; use production configuration or live Supabase URL when validating hosted provider setup.

---

## Changelog Reference

### Commits Included (April 24-30, 2026)
- `5afb11a` chore: Update version to 0.9.5 and upgrade Capacitor dependencies
- `c470175` feat: Add app icon and update Firebase configuration for experts
- `3b3656d` chore: Update MARKETING_VERSION to 1.0.0 in iOS project configuration
- `1b5da38` chore: Update .gitignore to include iOS SourcePackages directory
- `2001408` Stop tracking generated iOS build artifacts
- `6020974` chore: Revert MARKETING_VERSION to 1.0.0 in iOS project configuration
- `3160e84` fix: Update isExpertsApp signal to false in login.page.ts
- `d9ba1af` style: Enhance promotion story modal styling
- `552d0f9` feat: Add Apple OAuth login support and update related UI components

### Previous Version
- v1.0.6

---

## Store / Tester Notes

### iOS

<en-US>
v1.0.7 (iOS Internal)

- Added Apple sign-in support for customer login.
- Prepared iOS customer and experts build schemes, Firebase configs, icons, and export tooling.
- Cleaned up generated iOS build artifacts from source control.
</en-US>

### Android

<en-US>
v1.0.7 (Android Internal)

- Added Apple sign-in support for customer login.
- Updated shared Capacitor runtime dependencies used by Android builds.
- Kept customer and experts Android bundle commands ready for internal testing.
- Regression focus: login, Google/Facebook OAuth, Apple OAuth, and role-based navigation.
</en-US>
