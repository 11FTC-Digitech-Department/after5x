# After5 v0.2.0 Release Notes

**Release Date:** January 27, 2026  
**Version Name:** 0.2.0  
**Version Code:** 4 (Android)  
**Package:** com.rockit.after5

---

## What's New

### Payment System
- **Xendit Payment Integration** - Secure payment processing for booking services
- **In-App Payment Flow** - Complete payment directly within the app with real-time status updates
- **Deep Link Support** - Seamless return to app after external payment processing
- **Payment Success Animations** - Delightful confetti celebration on successful payments
- **Provider Wallet** - Providers can now view earnings and transaction history

### Enhanced Booking Experience
- **Booking Details Page** - View complete booking information at a glance
- **Booking Cancellation** - Cancel bookings with status tracking
- **Urgency Selection** - Specify how urgently you need the service
- **Smart Timeslots** - Past timeslots are automatically disabled based on selected date
- **Improved Address Selector** - Better search functionality and current location detection

### Provider Features
- **Provider Dashboard** - New dashboard with job management and statistics
- **Booking Calendar** - Visual calendar for better job scheduling
- **Job Execution Tracking** - Real-time updates during service delivery
- **Earnings Overview** - Track completed jobs and wallet balance

### Notifications
- **Real-Time Notifications** - Instant updates for booking changes
- **Notification Center** - Central place to view all notifications
- **Unread Badge Counter** - Know at a glance if you have new notifications
- **Notification Settings** - Control which notifications you receive

### Profile & Settings
- **Edit Profile** - Update your personal information
- **Business Profile** (Providers) - Manage business details
- **Address Management** - Save and manage multiple addresses
- **Support Page** - Get help when you need it
- **Privacy Policy & Terms** - Easy access to legal documents

### Technical Improvements
- **iOS Support** - Full iOS build configuration added
- **Real-Time Subscriptions** - Live updates for bookings and notifications
- **Improved Error Handling** - Better feedback when things go wrong
- **Performance Optimizations** - Faster app loading and navigation
- **R8 Code Optimization** - Reduced app size with code shrinking

---

## Bug Fixes
- Fixed provider matching function for better service provider assignment
- Fixed authentication flow and session management
- Resolved Google Maps transparency issues on Android
- Fixed user creation triggers and profile sync
- Fixed booking GPS logs RLS policies

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 0.2.0        | 4            | 22      | 35         |
| iOS      | 0.2.0        | 3            | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Files

- **Bundle:** `android/app/build/outputs/bundle/release/app-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/release/mapping.txt`

---

## Changelog Reference

### Commits Included
- Integrate Xendit payment system and enhance payment features (#2)
- Improved booking experience for customers and providers (#1)

### Previous Version
- v0.1.0 (Version Code 2)

---

## Google Play Store Release Notes

> Character limit: 500 characters

<en-US>
What's New in v0.2.0:

💳 Payments
• Xendit payment integration
• In-app payment with status tracking
• Provider wallet & earnings

📅 Bookings
• New booking details page
• Urgency selection
• Smart timeslot availability
• Booking cancellation

🔔 Notifications
• Real-time updates
• Notification center
• Customizable settings

👤 Profile
• Edit profile & addresses
• Business profile for providers

🐛 Bug fixes & performance improvements
</en-US>
