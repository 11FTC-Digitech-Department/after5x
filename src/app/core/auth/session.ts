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
        // Profile should be created by trigger, but if not, it will be created on next login
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    }
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }
}