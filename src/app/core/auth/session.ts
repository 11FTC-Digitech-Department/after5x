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
    
    // 1. Check current session
    const { data } = await this.supabase.auth.getSession();
    this._session.set(data.session);

    if (data.session) {
      await this.fetchProfile(data.session.user.id);
    }
    
    this._loading.set(false);

    // 2. Listen for changes (Login/Logout)
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      this._session.set(session);
      if (session) {
        await this.fetchProfile(session.user.id);
      } else {
        this._profile.set(null);
        this.router.navigateByUrl('/auth/welcome');
      }
    });
  }

  private async fetchProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      this._profile.set(data as UserProfile);
    }
  }

  async signOut() {
    await this.supabase.auth.signOut();
  }
}