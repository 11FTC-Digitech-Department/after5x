import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import {
  WalletBalance,
  WalletTransaction,
  WalletData,
  WalletTransactionRow,
  WalletTransactionType
} from '../models/payment.model';
import { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);

  private walletChannel: RealtimeChannel | null = null;

  /**
   * Get provider's wallet balance
   */
  async getWalletBalance(): Promise<WalletBalance> {
    const profile = this.sessionService.profile();

    if (!profile || profile.role !== 'provider') {
      throw new Error('User is not a provider');
    }

    const client = this.supabaseService.client;

    // Use type assertion since RPC function may not be in generated types yet
    const { data, error } = await (client.rpc as any)('get_provider_wallet', {
      p_provider_id: profile.id
    }) as { data: WalletData[] | null; error: any };

    if (error) {
      console.error('Failed to get wallet:', error);
      throw new Error('Failed to retrieve wallet information');
    }

    // If no wallet exists yet, return zero balance
    if (!data || data.length === 0) {
      return {
        walletId: null,
        available: 0,
        frozen: 0,
        currency: 'PHP',
        lastUpdated: null
      };
    }

    const wallet = data[0];

    return {
      walletId: wallet.wallet_id,
      available: wallet.balance,
      frozen: wallet.frozen_balance,
      currency: wallet.currency,
      lastUpdated: wallet.last_transaction_at
    };
  }

  /**
   * Get transaction history
   */
  async getTransactions(limit: number = 20, offset: number = 0): Promise<WalletTransaction[]> {
    const profile = this.sessionService.profile();

    if (!profile || profile.role !== 'provider') {
      throw new Error('User is not a provider');
    }

    const client = this.supabaseService.client;

    // Use type assertion since RPC function may not be in generated types yet
    const { data, error } = await (client.rpc as any)('get_wallet_transactions', {
      p_provider_id: profile.id,
      p_limit: limit,
      p_offset: offset
    }) as { data: WalletTransactionRow[] | null; error: any };

    if (error) {
      console.error('Failed to get transactions:', error);
      throw new Error('Failed to retrieve transaction history');
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(tx => ({
      id: tx.id,
      type: tx.type as WalletTransactionType,
      amount: tx.amount,
      balanceAfter: tx.balance_after,
      description: tx.description,
      bookingId: tx.booking_id,
      createdAt: tx.created_at
    }));
  }

  /**
   * Subscribe to wallet updates (real-time)
   */
  subscribeToWallet(callback: (wallet: WalletBalance) => void): () => void {
    const profile = this.sessionService.profile();

    if (!profile || profile.role !== 'provider') {
      console.warn('Cannot subscribe to wallet: user is not a provider');
      return () => {};
    }

    const client = this.supabaseService.client;

    // Subscribe to wallet changes
    const channel = client
      .channel(`wallet-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `owner_id=eq.${profile.id}`
        },
        async () => {
          console.log('[Wallet] Wallet update received');
          try {
            const balance = await this.getWalletBalance();
            callback(balance);
          } catch (error) {
            console.error('[Wallet] Error fetching balance:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wallet_transactions'
        },
        async (payload) => {
          // Check if this transaction belongs to the provider's wallet
          const transaction = payload.new as any;
          console.log('[Wallet] New transaction:', transaction);
          try {
            const balance = await this.getWalletBalance();
            callback(balance);
          } catch (error) {
            console.error('[Wallet] Error fetching balance:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Wallet] Subscription status:', status);
      });

    this.walletChannel = channel;

    return () => {
      channel.unsubscribe();
      this.walletChannel = null;
    };
  }

  /**
   * Format currency amount for display
   */
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Get transaction type display info
   */
  getTransactionTypeInfo(type: WalletTransactionType): { label: string; color: string; icon: string } {
    const typeInfo: Record<WalletTransactionType, { label: string; color: string; icon: string }> = {
      'CREDIT': { label: 'Received', color: 'success', icon: 'arrow-down-circle' },
      'DEBIT': { label: 'Sent', color: 'danger', icon: 'arrow-up-circle' },
      'WITHDRAWAL': { label: 'Withdrawn', color: 'warning', icon: 'wallet-outline' },
      'ADJUSTMENT': { label: 'Adjustment', color: 'medium', icon: 'swap-horizontal' }
    };

    return typeInfo[type] || { label: type, color: 'medium', icon: 'help-circle' };
  }

  /**
   * Format relative time for transactions
   */
  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}
