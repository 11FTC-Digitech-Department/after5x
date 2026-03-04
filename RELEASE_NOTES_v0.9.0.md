# After5 v0.9.0 Release Notes (Internal Testing)

**Release Date:** March 4, 2026  
**Version Name:** 0.9.0  
**Version Code:** 14 (Android)  
**Package:** com.rockit.after5  
**Distribution:** Internal testing only - not for public release

---

## Internal Testing

This build is intended for **internal QA and stakeholder testing** only. Please report issues, UX feedback, and device-specific behavior through the team's chosen channel (e.g. Slack, Linear, or internal tracker).

### Scope of This Release
- Version/package alignment update for `0.9.0` (`Android versionCode 14`, `iOS MARKETING_VERSION 0.9.0`).
- Promotion story modal, Special Offers carousel, Fuel Delivery gas amount fee.

### Focus Areas for Testers
- [ ] Promotion story modal display and Special Offers carousel on home page
- [ ] Fuel Delivery booking flow (gas amount from variant, read-only display)
- [ ] Special Offers with/without image (image-only vs text layout)
- [ ] Regression checks vs v0.8.0 on voucher/payment/booking flows

---

## What's New (since last release)

### Customer
- Added promotion story modal to display offers on the home page.
- Special Offers carousel: horizontally scrollable cards, image or text layout based on `image_url`.
- Fuel Delivery gas amount: select at variant (catalog), read-only on booking form; paid in cash at completion.
- Simplified gas payment labels to "Paid in cash." across booking, payment, and details pages.
- Renamed "Automotive" category to "Roadside Assistance."
- Home page offers support discount labels, conditions, and optional promotion images.

### Provider
- No provider-specific changes in this release.

### Technical
- Added `PromotionStoryService` for story offers and session state.
- Added `PromotionStoryModalComponent` for modal display.
- SQL migrations for offer fields, promotion image storage, gas amount fee schema, and service variants.
- SQL migration for test offer without image (TOWING50) to exercise text layout.
- EdgeToEdge runs only on native Android (`Capacitor.isNativePlatform()` guard).
- Version updates in this release candidate.
- Android bumped `0.8.0 (13)` -> `0.9.0 (14)`.
- iOS `MARKETING_VERSION` bumped `0.8.0` -> `0.9.0`.

---

## Bug Fixes
- Fixed promotion story modal image positioning (center alignment).

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 0.9.0        | 14           | 24      | 36         |
| iOS      | 0.9.0        | 4            | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key (`android/keystore.properties` required)
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Artifacts

- **Android Bundle:** `android/app/build/outputs/bundle/customerRelease/app-customer-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/customerRelease/mapping.txt`
- **iOS:** Build via Xcode or CI; ensure `MARKETING_VERSION=0.9.0` and `CURRENT_PROJECT_VERSION=4`

---

## Changelog Reference

### Commits Included
- `74a1220` - refactor: Simplify gas payment display and update related components
- `6a1d6c4` - feat: Add gas amount fee for Fuel Delivery and update related components
- `9689882` - fix: Center image position in promotion story modal styles
- `2247dc7` - feat: Implement promotion story feature with modal display
- Uncommitted: Special Offers carousel, EdgeToEdge guard, migration for TOWING50 test offer

### Previous Version
- v0.8.0

---

## Google Play Internal Testing Notes

> For internal testing track upload only. Store listing and release notes are not required for internal testers.

<en-US>
v0.9.0 (Internal)

- Promotion story modal and Special Offers carousel with image/text layouts.
- Fuel Delivery gas amount from variant, paid in cash at completion.
- Renamed Automotive to Roadside Assistance. Version bump to 0.9.0.
</en-US>
