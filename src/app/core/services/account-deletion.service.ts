import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { devError } from '../utils/logger';

export interface AccountDeletionBlocker {
  code: string;
  count?: number;
  message: string;
}

export interface AccountDeletionResult {
  success: boolean;
  code?: string;
  message?: string;
  blockers?: AccountDeletionBlocker[];
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountDeletionService {
  private supabaseService = inject(SupabaseService);

  async deleteAccount(confirmation: string): Promise<AccountDeletionResult> {
    try {
      const { data, error } = await this.supabaseService.client.functions.invoke('delete-account', {
        body: {
          confirmation,
          reason: 'self_service'
        }
      });

      if (error) {
        const context = error.context as any;
        const responseBody = typeof context?.json === 'function'
          ? await context.json().catch(() => null)
          : null;
        return {
          success: false,
          code: responseBody?.code,
          message: responseBody?.message,
          blockers: responseBody?.blockers,
          error: responseBody?.error || error.message || 'Unable to delete account'
        };
      }

      return {
        success: !!data?.success,
        code: data?.code,
        message: data?.message,
        blockers: data?.blockers,
        error: data?.error
      };
    } catch (err: any) {
      devError('Account deletion failed:', err);
      return {
        success: false,
        error: err.message || 'Unable to delete account'
      };
    }
  }
}
