# After5 v1.0.0 Release Notes

**Release Date:** March 10, 2026  
**Version Name:** 1.0.0  
**Version Code:** 17 (Android)  
**Package:** com.rockit.after5  
**Distribution:** (Specify: Internal testing / Public release)

---

## Internal Testing

This build is intended for **internal QA and stakeholder testing** only. Please report issues, UX feedback, and device-specific behavior through the team's chosen channel (e.g. Slack, Linear, or internal tracker).

### Scope of This Release
- Customer: Booking cancellation, booking form navigation, welcome page responsiveness.
- Provider: Segment-based dashboard scheduling, profile/avatar storage, Android build improvements.
- Chat: Participant fetching/RLS refactor, input layout, light mode visibility, image referrerpolicy.
- Storage: User avatar bucket with access policies.

### Focus Areas for Testers
- [ ] Booking cancellation flow end-to-end
- [ ] Provider dashboard segment-based navigation
- [ ] Chat: participant display and input visibility
- [ ] Avatar upload and display on profile
- [ ] Welcome page responsiveness across viewports
- [ ] Regression checks on booking, payment, and address flows

---

## What's New (since v0.9.5)

### Customer
- Booking cancellation support.
- Improved booking form navigation and styling.
- Welcome page responsiveness with media queries.
- Service details page card title clarification.

### Provider
- Dashboard navigation supports segment-based scheduling.
- Profile page and Android build improvements.
- User avatar storage with access policies.

### Chat
- Participant fetching and RLS handling refactor.
- Chat input layout and light mode visibility fix.
- Image tags: referrerpolicy for enhanced security.

### Storage
- User avatar storage bucket with access policies.

### Technical
- Storage bucket for user avatars; RLS and access policies.
- `getChatContext` refactored for participant fetching and RLS.
- Chat input: light mode forced for visibility; layout/styling updates.
- Dashboard navigation segment-based scheduling support.
- Booking cancellation logic and status handling.

---

## Bug Fixes
- Chat input: force light mode for better visibility.
- Service details: clarified card title.

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 1.0.0        | 17           | 24      | 36         |
| iOS      | 1.0.0        | 7            | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key (`android/keystore.properties` required)
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Artifacts

- **Android Bundle:** `android/app/build/outputs/bundle/customerRelease/app-customer-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/customerRelease/mapping.txt`
- **iOS:** Build via Xcode or CI; ensure `MARKETING_VERSION=1.0.0` and `CURRENT_PROJECT_VERSION=7`

---

## Changelog Reference

### Commits Included (March 9, 2026)
- `4945c4a` feat: Add storage bucket for user avatars with access policies
- `7061128` feat: Add referrerpolicy attribute to image tags for enhanced security
- `94fe8bc` feat: Refactor getChatContext to improve participant fetching and RLS handling
- `d1bc3f5` feat: Enhance Android build process and update profile page components
- `3a65f30` feat: Update dashboard navigation to support segment-based scheduling
- `7a53a98` feat: Implement booking cancellation logic and update status handling
- `9818ed5` style: Update chat input component styles for improved layout and consistency
- `a3cc7c7` fix: Force light mode for improved chat input visibility
- `59fdc51` feat: Enhance booking form navigation and styling
- `d78b6c7` feat: Enhance welcome page responsiveness with media queries
- `cd6321e` fix: Update card title in service details page for clarity

### Previous Version
- v0.9.5

---

## Google Play Internal Testing Notes

> For internal testing track upload only. Store listing and release notes are not required for internal testers.

<en-US>
v1.0.0 (Internal)

- Customer: Booking cancellation, booking form navigation, welcome page responsiveness.
- Provider: Segment-based dashboard scheduling, profile and avatar storage.
- Chat: Participant fetching/RLS refactor, input layout, light mode visibility.
- Storage: User avatar bucket with access policies.
</en-US>
