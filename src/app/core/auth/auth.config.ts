/**
 * Centralized Authentication Configuration
 * Single source of truth for all auth-related constants
 */

export const AUTH_CONFIG = {
  // App scheme for deep linking - must match capacitor.config.ts appId
  appScheme: 'com.rockit.after5',

  // Biometric configuration
  biometric: {
    storageKey: 'after5_biometric_enabled',
    sessionTokenKey: 'after5_biometric_session',
    promptTitle: 'Authenticate',
    promptSubtitle: 'Use biometrics to unlock After5',
    negativeButtonText: 'Use Password'
  },

  // Phone OTP configuration
  phoneOtp: {
    resendCooldownSeconds: 60,
    codeLength: 6,
    maxAttempts: 3
  },

  // Session configuration
  session: {
    // How long to wait for profile to load before navigating
    profileLoadTimeoutMs: 3000,
    // Check interval when waiting for profile
    profileCheckIntervalMs: 100
  }
} as const;

// Type exports for type safety
export type AuthConfig = typeof AUTH_CONFIG;
export type BiometricConfig = typeof AUTH_CONFIG.biometric;
