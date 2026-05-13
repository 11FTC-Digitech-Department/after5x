# After5 v1.1.1 Release Notes

**Release Date:** May 7, 2026  
**Version Name:** 1.1.1 (release notes target)  
**Version Code:** 23 (Android current project setting)  
**Package:** com.rockit.after5 / com.rockit.after5.experts  
**Distribution:** Internal testing / release candidate

---

## Scope

This release document covers platform and app changes merged from **May 5, 2026 through May 7, 2026**.

Primary focus:
- Guest browsing flow for app store compliance.
- Home header and guest auth action placement on small screens.
- Login and signup page responsiveness improvements so actions fit better on compact devices.
- Minor release-note and UI follow-up cleanup after v1.1.0.

---

## iOS Changes

- Current iOS project state remains mixed across configurations:
  - Some release configs still show `MARKETING_VERSION = 1.0.5`.
  - Other release configs now show `MARKETING_VERSION = 1.1.0`.
  - `CURRENT_PROJECT_VERSION = 6` is present in the release-oriented configurations.
- Before uploading to TestFlight, align all release configurations to the intended **1.1.1** marketing version and bump the build number as needed.

---

## Android Changes

- Current Android project settings remain:
  - `versionName "1.0.6"`
  - `versionCode 23`
- Before Play Console upload, update `versionName` / `versionCode` if this release should ship as **1.1.1**.

---

## App Changes

### Guest browsing / compliance
- Added guest mode browse flow for customers who want to view services without signing in.
- Guest access keeps the home browsing experience available while still exposing auth entry points where needed.

### Home header / auth entry
- Moved guest `Login` / `Register` actions out of the top toolbar into a dedicated content banner so they no longer overlap the header title on smaller iPhones.
- Tightened header title width and toolbar spacing to keep the home header readable on compact viewports.
- Refined the guest auth banner layout so it stacks cleanly on narrow screens.

### Login / signup responsiveness
- Reduced login and signup form spacing and button sizes for smaller viewports.
- Tightened logo, segment, divider, and CTA spacing on the auth page to better fit short device heights.
- Made the guest entry button and other auth actions more compact on small screens while preserving touch usability.

### Documentation
- Added `RELEASE_NOTES_v1.1.0.md` in-repo in the previous release cycle.

---

## Release Readiness Checklist

### iOS
- [ ] Align all `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` values before archiving.
- [ ] Verify the home header and guest auth banner render correctly on compact devices.
- [ ] Run customer and experts flows on device and confirm guest browsing, login, and signup navigation.

### Android
- [ ] Align `versionName` and `versionCode` before Play Console upload.
- [ ] Verify the same guest browsing and auth entry behavior on Android phones.
- [ ] Confirm the compact auth layout still fits correctly on smaller screen heights.

### Shared
- [ ] Regression test normal login, signup, OAuth, and role-based routing.
- [ ] Confirm guest browsing does not expose protected actions that require authentication.
- [ ] Validate the UI on at least one compact phone viewport and one larger phone viewport.

---

## Known Configuration Notes

- iOS release configuration values are still mixed in the project file; align them before shipping.
- Guest browsing is meant to reduce friction for store review while keeping auth entry points visible.
- Compact auth layouts should be checked against devices with taller notches and smaller available vertical space.

---

## Changelog Reference

### Commits Included (since v1.1.0 / `2cb76b1`)
- `d9745f8` Ssn 260 implement guest mode browse services without login for app store compliance (#18)
- `f26ac42` style: Update login and signup forms for improved responsiveness and aesthetics

### Previous Version
- v1.1.0

---

## Store / Tester Notes

### iOS

<en-US>
v1.1.1 (iOS Internal)

- Browse services without login for guest users.
- Home auth actions moved out of the toolbar so the title stays readable on small screens.
- Login and signup screens use a more compact layout on short devices.
</en-US>

### Android

<en-US>
v1.1.1 (Android Internal)

- Browse services without login for guest users.
- Home auth actions moved out of the toolbar so the title stays readable on small screens.
- Login and signup screens use a more compact layout on short devices.
</en-US>
