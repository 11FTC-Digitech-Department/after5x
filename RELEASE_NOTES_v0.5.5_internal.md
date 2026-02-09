# After5 v0.5.5 Release Notes (Internal Testing)

**Release Date:** February 9, 2026  
**Version Name:** 0.5.5  
**Version Code:** 10 (Android)  
**Package:** com.rockit.after5  
**Distribution:** Internal testing only — not for public release

---

## Internal Testing

This build is intended for **internal QA and stakeholder testing** only. Please report issues, UX feedback, and device-specific behavior through the team’s chosen channel (e.g. Slack, Linear, or internal tracker).

### Focus Areas for Testers
- [ ] End-to-end booking flow (create → pay → status updates)
- [ ] Provider job execution and real-time updates
- [ ] Notifications and deep links
- [ ] Payment success flow and wallet
- [ ] Profile and address management
- [ ] Any regressions from v0.2.0 / previous internal builds

---

## What's New (since last release)

### Customer
- _Add customer-facing changes here_
- Booking details and cancellation flows
- Payment and wallet experience

### Provider
- _Add provider-facing changes here_
- Job execution and dashboard
- Earnings and calendar

### Technical
- _Add infrastructure, performance, or dependency updates here_

---

## Bug Fixes
- _List fixes included in this build_

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 0.5.5        | 10           | 22      | 35         |
| iOS      | 0.5.5        | 10           | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Artifacts

- **Android Bundle:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/release/mapping.txt`
- **iOS:** Build via Xcode or CI; ensure MARKETING_VERSION=0.5.5, CURRENT_PROJECT_VERSION=10 for this release

---

## Changelog Reference

### Commits Included
- _Link or list commits since last tagged release_

### Previous Version
- v0.2.0 (Version Code 4) — or last internal build reference

---

## Google Play Internal Testing Notes

> For internal testing track upload only. Store listing and release notes are not required for internal testers.

<en-US>
v0.5.5 (Internal)

• Internal testing build — please verify booking, payment, and provider flows.
• Report issues to the team.
</en-US>
