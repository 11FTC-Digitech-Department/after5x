# After5 v0.9.1 Release Notes (Internal Testing)

**Release Date:** March 5, 2026  
**Version Name:** 0.9.1  
**Version Code:** 15 (Android)  
**Package:** com.rockit.after5  
**Distribution:** Internal testing only - not for public release

---

## Internal Testing

This build is intended for **internal QA and stakeholder testing** only. Please report issues, UX feedback, and device-specific behavior through the team's chosen channel (e.g. Slack, Linear, or internal tracker).

### Scope of This Release
- Provider: Wallet tab replaced with Transactions tab; booking history with search and date range filter.
- Customer: Service area notice, location validation, contact number guide, body camera fee clarification.
- UI/UX: Address selector notice styling, date picker improvements.

### Focus Areas for Testers
- [ ] Transactions page: search by Booking ID, date range filter, booking list with Created/Completed dates
- [ ] Address selector: service area notice (Quezon City) visibility and styling
- [ ] Map location selection: validation when outside Quezon City bounds
- [ ] Booking form: contact number format guide, body camera fee note
- [ ] Job execution: payment complete card removed
- [ ] Regression checks on booking, payment, and address flows

---

## What's New (since v0.9.0)

### Customer
- Service area notice on address selector: "During our soft launch period, After5 is only available within Quezon City. Please stay tuned for our official launch in other areas." (warning-style yellow with improved text visibility).
- Location validation: map selection restricted to Quezon City bounds; error feedback when location is outside service area.
- Contact number field: added format guide below input ("09XXXXXXXXX or +639XXXXXXXXX") that stays visible when typing.
- Body camera optional fee: clarified that additional amount "will be applied to the total booking cost."

### Provider
- Replaced Wallet tab with Transactions tab; route changed from `/p/wallet` to `/p/transactions`.
- Transactions page shows booking history (Booking ID, customer name, Created date, Completed date, grand total).
- Search bar to filter by Booking ID.
- Date range filter: From/To date selection with user-friendly modal and calendar picker.
- Removed payment complete card from job execution page (the card that showed provider earnings when paid).

### Technical
- New Transactions page; removed Wallet page.
- Provider routes and tabs updated for transactions.
- `ProviderBookingService` used for transactions data; bookings filtered client-side by search and date.
- Map component: `restrictToBounds` and `selectionRejected` for location validation.
- `GoogleMapsService` enhanced with bounds validation for Quezon City.
- Global modal styling for date picker centering.
- Address selector notice uses `--ion-color-warning-tint` for visibility.

---

## Bug Fixes
- Date range filter modal: fixed white-only display (ng-template, breakpoints, keepContentsMounted, modal background).
- Date picker calendar: centered and fitted to width in modal.

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 0.9.1        | 15           | 24      | 36         |
| iOS      | 0.9.1        | 5            | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key (`android/keystore.properties` required)
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Artifacts

- **Android Bundle:** `android/app/build/outputs/bundle/customerRelease/app-customer-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/customerRelease/mapping.txt`
- **iOS:** Build via Xcode or CI; ensure `MARKETING_VERSION=0.9.1` and `CURRENT_PROJECT_VERSION=5`

---

## Changelog Reference

### Commits Included
- `796eabb` - feat: Update address selector styling for improved visibility
- `67cc26b` - feat: Update booking form with contact number guidance and body camera fee clarification
- `cd9d09b` - feat: Enhance transactions page with search and date filtering
- `c2cbdfd` - feat: Remove payment complete card from job execution page
- `b9aa2b4` - feat: Replace wallet page with transactions page and update routing
- `fb01f5c` - feat: Update body camera section in booking form
- `91224fc` - feat: Add service area notice to address selector page
- `cd83e22` - feat: Implement location validation and error handling in map components

### Previous Version
- v0.9.0

---

## Google Play Internal Testing Notes

> For internal testing track upload only. Store listing and release notes are not required for internal testers.

<en-US>
v0.9.1 (Internal)

- Provider: Wallet replaced with Transactions tab; search and date filter for booking history.
- Customer: Service area notice (Quezon City), location validation, contact number guide, body camera fee clarification.
- Removed payment complete card from provider job execution.
</en-US>
