# PKCE OAuth Testing Guide

## Overview
This guide provides comprehensive testing steps to validate the PKCE (Proof Key for Code Exchange) OAuth implementation for social login on mobile devices.

## Prerequisites
- Mobile app built and deployed to device/emulator
- Valid OAuth credentials configured in Supabase (Google, Facebook)
- Network connectivity for OAuth providers
- Supabase local/dev environment running

## Test Scenarios

### 1. Google OAuth Login Flow
**Expected Behavior:**
- User taps "Continue with Google"
- In-app browser opens with Google login
- After authentication, browser closes
- App processes PKCE code exchange
- User is redirected to appropriate dashboard based on role

**Validation Steps:**
```bash
# Build and run app
npm run build
npx cap run android  # or ios
```

**Console Logs to Monitor:**
```
OAuth: Opening google in in-app browser
PKCE OAuth parameters extracted: {code: 'present', hash: 'none (expected for PKCE)', ...}
CallbackPage: Exchanging PKCE code for session
CallbackPage: Code exchange successful
```

### 2. Facebook OAuth Login Flow
**Expected Behavior:**
- User taps "Continue with Facebook"
- In-app browser opens with Facebook login
- After authentication, browser closes
- App processes PKCE code exchange
- User is redirected to appropriate dashboard

**Console Logs to Monitor:**
```
OAuth: Opening facebook in in-app browser
PKCE OAuth parameters extracted: {code: 'present', hash: 'none (expected for PKCE)', ...}
CallbackPage: Exchanging PKCE code for session
CallbackPage: Code exchange successful
```

### 3. Error Scenarios

#### 3.1 Expired Authorization Code
**How to Test:**
- Complete OAuth login up to the point where you get the authorization code
- Wait 10+ minutes (codes typically expire in 10 minutes)
- Continue with the callback flow

**Expected Result:**
```
CallbackPage: Authorization code expired
Authentication failed: Login code expired. Please try logging in again.
```

#### 3.2 Invalid/Used Authorization Code
**How to Test:**
- Complete one successful OAuth login
- Try to use the same authorization code again (difficult to test naturally)

**Expected Result:**
```
CallbackPage: Invalid authorization code - may have expired or been used
Authentication failed: Login session expired. Please try logging in again.
```

#### 3.3 Network Issues During Code Exchange
**How to Test:**
- Complete OAuth login to get authorization code
- Disable network connectivity before code exchange
- Re-enable network and observe retry behavior

**Expected Result:**
- App should handle network errors gracefully
- Appropriate error message displayed

### 4. Deep Link Handling
**How to Test:**
- Close the app completely
- Trigger OAuth flow from external source (if applicable)
- Verify deep links properly route to callback page

**Expected Behavior:**
- App opens via deep link
- Processes OAuth callback correctly
- User ends up at appropriate dashboard

## Debugging Commands

### Enable Verbose Logging
Add to login page for debugging:
```typescript
// In login.page.ts ngOnInit or constructor
console.log('=== OAUTH DEBUG INFO ===');
console.log('Platform detection:', this.platform.platforms());
console.log('Redirect URLs:', {
  web: `${window.location.origin}/auth/callback`,
  mobile: 'com.rockit.after5://auth/callback'
});
```

### Manual OAuth URL Testing
```bash
# Test OAuth URL generation (add to console)
const { data } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'com.rockit.after5://auth/callback',
    queryParams: { access_type: 'offline', prompt: 'consent' },
    skipBrowserRedirect: true
  }
});
console.log('OAuth URL:', data.url);
```

## Success Criteria

### ✅ Functional Requirements
- [ ] OAuth login buttons trigger in-app browser
- [ ] Browser closes after successful authentication
- [ ] PKCE code is properly extracted from callback URL
- [ ] Code exchange succeeds and creates valid session
- [ ] User is redirected to correct dashboard based on role
- [ ] Session persists across app restarts

### ✅ Error Handling
- [ ] Network errors are handled gracefully
- [ ] Invalid/expired codes show appropriate error messages
- [ ] Browser timeout scenarios are handled
- [ ] Failed OAuth attempts don't crash the app

### ✅ Security Requirements
- [ ] No access tokens appear in browser URL
- [ ] No sensitive data logged to console in production
- [ ] PKCE verifier is properly generated and used
- [ ] Session tokens are securely stored

### ✅ Mobile UX Requirements
- [ ] In-app browser provides good user experience
- [ ] Loading states are shown during OAuth flow
- [ ] Error messages are user-friendly
- [ ] Deep links work when app is closed

## Common Issues & Solutions

### Issue: "Invalid redirect URI"
**Cause:** Mobile app scheme not configured in Supabase
**Solution:** Ensure `com.rockit.after5://auth/callback` is in `additional_redirect_urls`

### Issue: "PKCE verifier mismatch"
**Cause:** Code challenge/verifier not properly generated
**Solution:** Ensure Supabase client has `flowType: 'pkce'` configured

### Issue: Browser doesn't close after OAuth
**Cause:** Deep link handling not working
**Solution:** Verify Capacitor deep link configuration

### Issue: Code exchange fails with network error
**Cause:** Supabase server unreachable during exchange
**Solution:** Check network connectivity and Supabase configuration

## Performance Benchmarks
- OAuth initiation: < 2 seconds
- Browser redirect: < 5 seconds (depends on network)
- Code exchange: < 3 seconds
- Total flow: < 15 seconds

## Final Validation Checklist
- [ ] Test on both Android and iOS
- [ ] Test with different OAuth providers (Google, Facebook)
- [ ] Test error scenarios (network issues, expired codes)
- [ ] Test deep linking from closed app state
- [ ] Verify session persistence
- [ ] Check console logs for any security issues
- [ ] Validate user experience flow