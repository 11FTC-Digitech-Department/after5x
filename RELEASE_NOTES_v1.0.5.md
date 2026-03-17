# After5 v1.0.5 Release Notes

**Release Date:** March 17, 2026  
**Version Name:** 1.0.5  
**Version Code:** 22 (Android)  
**Package:** com.rockit.after5  
**Distribution:** (Specify: Internal testing / Public release)

---

## Internal Testing

This build is intended for **internal QA and stakeholder testing** only. Please report issues, UX feedback, and device-specific behavior through the team's chosen channel (e.g. Slack, Linear, or internal tracker).

### Scope of This Release
- Customer: Notifications soft delete, booking cancellation notifications, service details/catalog layout revamps, booking form button styling.
- Provider: Notification handling and soft delete.
- Technical: Database migrations for notification soft delete and booking status notifications.

### Focus Areas for Testers
- [ ] Notification soft delete (individual and bulk) on customer and provider apps
- [ ] Booking cancellation notification handling (no duplicate in-app alerts)
- [ ] Service details page: new layout, provider preview, price labels
- [ ] Catalog page: variant selection via ion-select, price display
- [ ] Booking form button styles and layout
- [ ] Notifications page back button navigation (defaultHref to /c/home)
- [ ] Regression checks on booking, payment, and notification flows

---

## What's New (since v1.0.0)

### Customer
- Notifications: soft delete for individual and bulk, with confirmation UI.
- Booking cancellation: skip duplicate in-app notifications when user cancels; enhanced notification data with initiator.
- Service details page: revamped layout, provider preview section, refined price/duration labels ("STARTING PRICE", "MINUTES").
- Catalog page: fallback variant selection replaced with ion-select, detailed price display (standard and after 5PM pricing).
- Booking form: enhanced button styles and layout, `.book-now-button` class for consistency with service details.

### Provider
- Notifications: soft delete support and confirmation UI.
- Notification handling: refreshed unread counts and deduplication in real-time.

### Technical
- NotificationService: soft delete methods; `is_deleted` and `deleted_at` schema fields.
- Database: migrations for notification soft delete and booking status change notifications (including cancellation).
- Server-side in-app notifications for booking status changes via database trigger.
- Customer/provider notification pages: exclude soft-deleted notifications from views.

---

## Bug Fixes
- Notifications page: back button defaultHref changed from `/c/bookings` to `/c/home`.

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 1.0.5        | 22           | 24      | 36         |
| iOS      | 1.0.5        | 12           | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key (`android/keystore.properties` required)
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Artifacts

- **Android Bundle:** `android/app/build/outputs/bundle/customerRelease/app-customer-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/customerRelease/mapping.txt`
- **iOS:** Build via Xcode or CI; ensure `MARKETING_VERSION=1.0.5` and `CURRENT_PROJECT_VERSION=12`

---

## Changelog Reference

### Commits Included (March 16–17, 2026)
- `6a2d3e6` feat: Enhance booking form button styles and layout
- `03b049e` feat: Add booking cancellation notification handling
- `a340918` feat: Implement soft delete functionality for notifications
- `70f6b8f` feat: Revamp service details page layout and styling
- `440f2b4` feat: Revamp fallback variant selection in catalog page
- `ee85f39` fix: Update back button navigation in notifications page
- `97c8d7c` feat: Enhance notification handling and booking status updates

### Previous Version
- v1.0.0

---

## Google Play Internal Testing Notes

> For internal testing track upload only. Store listing and release notes are not required for internal testers.

<en-US>
v1.0.5 (Internal)

- Customer: Notification soft delete, booking cancellation notification handling, service details and catalog revamps, booking form button styling.
- Provider: Notification soft delete and handling improvements.
- Fix: Notifications page back button navigation.
</en-US>
