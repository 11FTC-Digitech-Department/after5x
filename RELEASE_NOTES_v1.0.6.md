# After5 v1.0.6 Release Notes

**Release Date:** March 26, 2026  
**Version Name:** 1.0.6  
**Version Code:** 23 (Android)  
**Package:** com.rockit.after5  
**Distribution:** (Specify: Internal testing / Public release)

---

## Internal Testing

This build is intended for **internal QA and stakeholder testing** only. Please report issues, UX feedback, and device-specific behavior through the team's chosen channel (e.g. Slack, Linear, or internal tracker).

### Scope of This Release
- Customer & provider: Improved in-app feedback when unexpected errors occur; optional message when a new app version is available after deploy.
- Technical: Client error reporting pipeline to the backend, optional team alerting (Slack) via Edge Function `report-client-error`; lightweight context (last tap, last Edge Function call) attached to reports; production gated by `errorReporting.enabled` in app config.

### Focus Areas for Testers
- [ ] Trigger an app error path (e.g. broken flow) and confirm a short user-visible message where appropriate (no duplicate spam toasts).
- [ ] Airplane mode / offline: network errors behave as before; no UX regression on login (401 still routes to login).
- [ ] After a web deploy, dynamic import / chunk failure path shows "new version" style guidance if applicable.
- [ ] Regression: booking, payment, notifications, and Supabase-backed flows.
- [ ] Ops: Supabase project has `report-client-error` deployed and secrets set (`SLACK_ERROR_WEBHOOK_URL`, optionally `SLACK_ERROR_USERNAME`, `SLACK_ERROR_ICON_EMOJI`).

---

## What's New (since v1.0.5)

### Customer
- Clearer short message when something unexpected goes wrong (global error handler).
- When a new web bundle is available, prompt to reload instead of a silent failure (chunk load errors).

### Provider
- Same error UX improvements as customer build (shared app shell and handlers).

### Technical
- `ErrorReportingService`: payloads sent to Edge Function `report-client-error` (route, platform, environment, user id when signed in, optional stack, `lastAction`, `lastInvoke`, source `global` | `http`).
- `GlobalErrorHandler`: reports unhandled errors; filters noisy cases (navigation cancel, ResizeObserver, empty promise rejections); toasts for generic and chunk-load cases.
- `httpErrorInterceptor`: reports HTTP network failures (status 0) and 5xx responses; 401 still redirects to login without reporting as a server error.
- `ErrorContextService` + `AppComponent`: records last meaningful tap target label for context.
- `SupabaseService`: wraps `functions.invoke` to record last invoked function name before each call.
- Edge Function `report-client-error`: validates payload, POSTs formatted text to Slack incoming webhook; configurable bot name and icon via environment.
- Environments: `errorReporting.enabled` (e.g. `true` in production per `environment.prod.ts`).

---

## Bug Fixes

- None targeted in this release.

---

## Build Information

| Platform | Version Name | Version Code | Min SDK | Target SDK |
|----------|--------------|--------------|---------|------------|
| Android  | 1.0.6        | 23           | 24      | 36         |
| iOS      | 1.0.6        | 4            | 16.1    | -          |

### Build Configuration
- **Signing:** Release signed with upload key (`android/keystore.properties` required)
- **Minification:** R8 enabled with ProGuard rules
- **Bundle:** Android App Bundle (.aab)

---

## Artifacts

- **Android Bundle:** `android/app/build/outputs/bundle/customerRelease/app-customer-release.aab`
- **Mapping:** `android/app/build/outputs/mapping/customerRelease/mapping.txt`
- **iOS:** Build via Xcode or CI; ensure `MARKETING_VERSION=1.0.6` and `CURRENT_PROJECT_VERSION=4`

---

## Changelog Reference

### Commits Included (March 26, 2026)
- `fb76098` feat: Integrate ErrorContextService for enhanced error tracking
- `3a74376` feat: Implement error reporting functionality across the application

### Previous Version
- v1.0.5

---

## Google Play Internal Testing Notes

> For internal testing track upload only. Store listing and release notes are not required for internal testers.

<en-US>
v1.0.6 (Internal)

- Stability improvements so we can spot and fix rare issues faster.
- Clearer on-screen message when something goes wrong.
- If you are on an older app screen after we ship an update, you may be asked to refresh so everything loads correctly.
</en-US>
