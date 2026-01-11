import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase';
import { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'provider' | 'admin';
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private supabase = inject(SupabaseService).client;
  private router = inject(Router);

  // --- STATE (Signals) ---
  private _session = signal<Session | null>(null);
  private _profile = signal<UserProfile | null>(null);
  private _loading = signal<boolean>(true);
  private _initialized = signal<boolean>(false);

  // --- COMPUTED (Read-only) ---
  readonly session = this._session.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly isLoading = this._loading.asReadonly();
  
  readonly isAuthenticated = computed(() => !!this._session());
  readonly userRole = computed(() => this._profile()?.role);

  constructor() {
    this.initSession();
  }

  private async initSession() {
    this._loading.set(true);

    try {
      // 1. Check current session
      const { data, error } = await this.supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      }

      this._session.set(data.session);

      if (data.session) {
        await this.fetchProfile(data.session.user.id);
      }
    } catch (error) {
      console.error('Error during session initialization:', error);
    }

    this._loading.set(false);
    this._initialized.set(true);

    // 2. Listen for changes (Login/Logout)
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      const wasAuthenticated = !!this._session();
      this._session.set(session);

      if (session) {
        await this.fetchProfile(session.user.id);
      } else {
        this._profile.set(null);
        // Only navigate to welcome if user was previously authenticated (logout)
        // and not during initial app load
        if (wasAuthenticated && this._initialized()) {
          this.router.navigateByUrl('/auth/welcome');
        }
      }
    });
  }

  private async fetchProfile(userId: string) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        this._profile.set(data as UserProfile);
      } else {
        console.warn('Profile not found for user:', userId);
        // Try to create profile for OAuth users
        await this.createProfileIfNeeded(userId);
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    }
  }

  private async createProfileIfNeeded(userId: string) {
    try {
      // Get current user info
      const { data: userData, error: userError } = await this.supabase.auth.getUser();

      if (userError || !userData.user) {
        console.error('Error getting user data:', userError);
        return;
      }

      const user = userData.user;

      // Check if profile exists again (race condition protection)
      const { data: existingProfile } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        await this.fetchProfile(userId);
        return;
      }

      // Create profile for OAuth user
      const profileData = {
        id: userId,
        email: user.email || '',
        full_name: this.extractFullName(user),
        role: 'customer' as const, // Default role
        phone_number: user.user_metadata?.['phone'] || user.phone || null,
        avatar_url: user.user_metadata?.['avatar_url'] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await this.supabase
        .from('profiles')
        .insert(profileData);

      if (insertError) {
        console.error('Error creating profile:', insertError);
        return;
      }

      console.log('Profile created successfully for OAuth user:', userId);
      this._profile.set(profileData as UserProfile);

    } catch (error) {
      console.error('Error creating profile for OAuth user:', error);
    }
  }

  private extractFullName(user: User): string {
    // Try different sources for the full name
    if (user.user_metadata?.['full_name']) {
      return user.user_metadata['full_name'];
    }
    if (user.user_metadata?.['name']) {
      return user.user_metadata['name'];
    }
    if (user.user_metadata?.['first_name'] && user.user_metadata?.['last_name']) {
      return `${user.user_metadata['first_name']} ${user.user_metadata['last_name']}`;
    }
    // Fallback to email username
    return user.email?.split('@')[0] || 'User';
  }

  async setSession(session: Session) {
    this._session.set(session);
    await this.fetchProfile(session.user.id);
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }
}