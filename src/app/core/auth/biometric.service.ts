import { Injectable, inject, signal } from '@angular/core';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Platform } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import { SupabaseService } from '../supabase/supabase';
import { AUTH_CONFIG } from './auth.config';

export interface BiometricCapability {
  isAvailable: boolean;
  biometryType: BiometryType;
  errorMessage?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

/**
 * Service for managing biometric authentication (Face ID, Touch ID, Fingerprint).
 * Stores refresh tokens securely and allows quick re-authentication for returning users.
 */
@Injectable({
  providedIn: 'root'
})
export class BiometricService {
  private platform = inject(Platform);
  private supabaseService = inject(SupabaseService);

  // Reactive state using Angular signals
  private _isBiometricAvailable = signal<boolean>(false);
  private _isBiometricEnabled = signal<boolean>(false);
  private _biometryType = signal<BiometryType>(BiometryType.NONE);
  private _isInitialized = signal<boolean>(false);

  readonly isBiometricAvailable = this._isBiometricAvailable.asReadonly();
  readonly isBiometricEnabled = this._isBiometricEnabled.asReadonly();
  readonly biometryType = this._biometryType.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize biometric service - check availability and load settings
   */
  private async initialize() {
    if (!this.platform.is('capacitor')) {
      console.log('BiometricService: Not running on Capacitor, biometrics unavailable');
      this._isInitialized.set(true);
      return;
    }

    try {
      const capability = await this.checkBiometricCapability();
      this._isBiometricAvailable.set(capability.isAvailable);
      this._biometryType.set(capability.biometryType);

      if (capability.isAvailable) {
        const enabled = await this.getBiometricEnabledSetting();
        this._isBiometricEnabled.set(enabled);
        console.log('BiometricService: Initialized -', this.getBiometryTypeName(), enabled ? 'enabled' : 'disabled');
      } else {
        console.log('BiometricService: Biometrics not available -', capability.errorMessage);
      }
    } catch (error) {
      console.error('BiometricService: Initialization failed:', error);
    } finally {
      this._isInitialized.set(true);
    }
  }

  /**
   * Check if device supports biometric authentication
   */
  async checkBiometricCapability(): Promise<BiometricCapability> {
    if (!this.platform.is('capacitor')) {
      return { isAvailable: false, biometryType: BiometryType.NONE };
    }

    try {
      const result = await NativeBiometric.isAvailable();
      return {
        isAvailable: result.isAvailable,
        biometryType: result.biometryType,
        errorMessage: result.errorCode ? `Error code: ${result.errorCode}` : undefined
      };
    } catch (error: any) {
      console.error('BiometricService: Capability check failed:', error);
      return {
        isAvailable: false,
        biometryType: BiometryType.NONE,
        errorMessage: error.message
      };
    }
  }

  /**
   * Enable biometric authentication for the current user
   * Stores the refresh token securely after biometric verification
   */
  async enableBiometric(refreshToken: string): Promise<BiometricAuthResult> {
    if (!this._isBiometricAvailable()) {
      return { success: false, error: 'Biometric authentication not available on this device' };
    }

    try {
      // First verify user can authenticate with biometrics
      await NativeBiometric.verifyIdentity({
        reason: 'Enable biometric login',
        title: AUTH_CONFIG.biometric.promptTitle,
        subtitle: 'Verify your identity to enable biometric unlock',
        negativeButtonText: AUTH_CONFIG.biometric.negativeButtonText
      });

      // Store the refresh token securely using biometric-protected storage
      await NativeBiometric.setCredentials({
        username: AUTH_CONFIG.biometric.sessionTokenKey,
        password: refreshToken,
        server: AUTH_CONFIG.appScheme
      });

      // Mark biometric as enabled in preferences
      await Preferences.set({
        key: AUTH_CONFIG.biometric.storageKey,
        value: 'true'
      });

      this._isBiometricEnabled.set(true);
      console.log('BiometricService: Biometric enabled successfully');
      return { success: true };

    } catch (error: any) {
      console.error('BiometricService: Enable failed:', error);
      return {
        success: false,
        error: this.getBiometricErrorMessage(error)
      };
    }
  }

  /**
   * Disable biometric authentication and clear stored credentials
   */
  async disableBiometric(): Promise<BiometricAuthResult> {
    try {
      // Delete stored credentials
      await NativeBiometric.deleteCredentials({
        server: AUTH_CONFIG.appScheme
      });

      // Mark biometric as disabled
      await Preferences.set({
        key: AUTH_CONFIG.biometric.storageKey,
        value: 'false'
      });

      this._isBiometricEnabled.set(false);
      console.log('BiometricService: Biometric disabled successfully');
      return { success: true };

    } catch (error: any) {
      console.error('BiometricService: Disable failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate user with biometrics and restore session
   * Returns success if session was refreshed successfully
   */
  async authenticateWithBiometric(): Promise<BiometricAuthResult> {
    if (!this._isBiometricEnabled()) {
      return { success: false, error: 'Biometric login not enabled' };
    }

    try {
      // Prompt for biometric verification
      await NativeBiometric.verifyIdentity({
        reason: AUTH_CONFIG.biometric.promptSubtitle,
        title: AUTH_CONFIG.biometric.promptTitle,
        subtitle: 'Unlock to continue',
        negativeButtonText: AUTH_CONFIG.biometric.negativeButtonText
      });

      // Get stored refresh token
      const credentials = await NativeBiometric.getCredentials({
        server: AUTH_CONFIG.appScheme
      });

      if (!credentials.password) {
        // No stored token, disable biometric
        await this.disableBiometric();
        return {
          success: false,
          error: 'No stored session found. Please login with password.'
        };
      }

      // Refresh session using stored token
      const { data, error } = await this.supabaseService.client.auth.refreshSession({
        refresh_token: credentials.password
      });

      if (error || !data.session) {
        console.error('BiometricService: Session refresh failed:', error);
        // Token is invalid/expired, disable biometric
        await this.disableBiometric();
        return {
          success: false,
          error: 'Session expired. Please login again.'
        };
      }

      // Update stored token with new refresh token
      if (data.session.refresh_token !== credentials.password) {
        await NativeBiometric.setCredentials({
          username: AUTH_CONFIG.biometric.sessionTokenKey,
          password: data.session.refresh_token,
          server: AUTH_CONFIG.appScheme
        });
      }

      console.log('BiometricService: Authentication successful');
      return { success: true };

    } catch (error: any) {
      console.error('BiometricService: Authentication failed:', error);
      return {
        success: false,
        error: this.getBiometricErrorMessage(error)
      };
    }
  }

  /**
   * Check if biometric credentials exist (without prompting)
   */
  async hasStoredCredentials(): Promise<boolean> {
    try {
      const credentials = await NativeBiometric.getCredentials({
        server: AUTH_CONFIG.appScheme
      });
      return !!credentials.password;
    } catch {
      return false;
    }
  }

  /**
   * Get human-readable name for the biometry type
   */
  getBiometryTypeName(): string {
    switch (this._biometryType()) {
      case BiometryType.FACE_ID:
        return 'Face ID';
      case BiometryType.TOUCH_ID:
        return 'Touch ID';
      case BiometryType.FINGERPRINT:
        return 'Fingerprint';
      case BiometryType.FACE_AUTHENTICATION:
        return 'Face Recognition';
      case BiometryType.IRIS_AUTHENTICATION:
        return 'Iris';
      case BiometryType.MULTIPLE:
        return 'Biometric';
      default:
        return 'Biometric';
    }
  }

  /**
   * Get biometric setting from preferences
   */
  private async getBiometricEnabledSetting(): Promise<boolean> {
    const { value } = await Preferences.get({ key: AUTH_CONFIG.biometric.storageKey });
    return value === 'true';
  }

  /**
   * Convert biometric error to user-friendly message
   */
  private getBiometricErrorMessage(error: any): string {
    const errorCode = error.code || error.errorCode;

    switch (errorCode) {
      case 10: // User cancelled
        return 'Authentication cancelled';
      case 11: // Too many attempts
        return 'Too many failed attempts. Try again later.';
      case 12: // Biometric not enrolled
        return 'No biometrics enrolled on this device';
      case 13: // Biometric not available
        return 'Biometric authentication not available';
      case 14: // Lockout
        return 'Biometric locked. Use device PIN to unlock.';
      case 15: // Biometric changed
        return 'Biometric data has changed. Please re-enable biometric login.';
      default:
        return error.message || 'Biometric authentication failed';
    }
  }
}
