import { devLog, devError } from '../../../../core/utils/logger';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonBadge,
  IonButton,
  IonSpinner,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonList,
  IonItem,
  IonLabel,
  ToastController,
  RefresherCustomEvent,
  InfiniteScrollCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  walletOutline,
  cashOutline,
  arrowDownCircle,
  arrowUpCircle,
  swapHorizontal,
  helpCircle,
  checkmarkCircle,
  timeOutline,
  receiptOutline,
  informationCircleOutline
} from 'ionicons/icons';

import { WalletService } from '@core/services/wallet.service';
import { WalletBalance, WalletTransaction, WalletTransactionType } from '@core/models/payment.model';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.page.html',
  styleUrls: ['./wallet.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonBadge,
    IonButton,
    IonSpinner,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonList,
    IonItem,
    IonLabel
  ]
})
export class WalletPage implements OnInit, OnDestroy {
  private walletService = inject(WalletService);
  private toastController = inject(ToastController);

  // State
  wallet = signal<WalletBalance | null>(null);
  transactions = signal<WalletTransaction[]>([]);
  isLoading = signal(true);
  isLoadingMore = signal(false);
  hasMoreTransactions = signal(true);
  error = signal<string | null>(null);

  // Pagination
  private transactionOffset = 0;
  private readonly PAGE_SIZE = 20;

  // Real-time subscription
  private unsubscribeWallet: (() => void) | null = null;

  constructor() {
    addIcons({
      walletOutline,
      cashOutline,
      arrowDownCircle,
      arrowUpCircle,
      swapHorizontal,
      helpCircle,
      checkmarkCircle,
      timeOutline,
      receiptOutline,
      informationCircleOutline
    });
  }

  async ngOnInit() {
    await this.loadWallet();
    this.subscribeToUpdates();
  }

  ngOnDestroy() {
    if (this.unsubscribeWallet) {
      this.unsubscribeWallet();
    }
  }

  async loadWallet() {
    this.isLoading.set(true);
    this.error.set(null);
    this.transactionOffset = 0;

    try {
      const [walletBalance, initialTransactions] = await Promise.all([
        this.walletService.getWalletBalance(),
        this.walletService.getTransactions(this.PAGE_SIZE, 0)
      ]);

      this.wallet.set(walletBalance);
      this.transactions.set(initialTransactions);
      this.hasMoreTransactions.set(initialTransactions.length >= this.PAGE_SIZE);
      this.transactionOffset = initialTransactions.length;
    } catch (err: any) {
      devError('Failed to load wallet:', err);
      this.error.set(err.message || 'Failed to load wallet information');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMoreTransactions(event: InfiniteScrollCustomEvent) {
    if (!this.hasMoreTransactions()) {
      event.target.complete();
      return;
    }

    this.isLoadingMore.set(true);

    try {
      const moreTransactions = await this.walletService.getTransactions(
        this.PAGE_SIZE,
        this.transactionOffset
      );

      if (moreTransactions.length > 0) {
        this.transactions.update(current => [...current, ...moreTransactions]);
        this.transactionOffset += moreTransactions.length;
      }

      this.hasMoreTransactions.set(moreTransactions.length >= this.PAGE_SIZE);
    } catch (err) {
      devError('Failed to load more transactions:', err);
      await this.showToast('Failed to load more transactions', 'danger');
    } finally {
      this.isLoadingMore.set(false);
      event.target.complete();
    }
  }

  private subscribeToUpdates() {
    this.unsubscribeWallet = this.walletService.subscribeToWallet(
      (wallet) => {
        devLog('[Wallet] Real-time update:', wallet);
        this.wallet.set(wallet);
        // Reload transactions to show new ones
        this.loadTransactionsOnly();
      }
    );
  }

  private async loadTransactionsOnly() {
    try {
      const latestTransactions = await this.walletService.getTransactions(this.PAGE_SIZE, 0);
      this.transactions.set(latestTransactions);
      this.transactionOffset = latestTransactions.length;
    } catch (err) {
      devError('Failed to refresh transactions:', err);
    }
  }

  async handleRefresh(event: RefresherCustomEvent) {
    await this.loadWallet();
    event.target.complete();
  }

  // Helper methods
  formatAmount(amount: number): string {
    return this.walletService.formatAmount(amount);
  }

  getTransactionIcon(type: WalletTransactionType): string {
    return this.walletService.getTransactionTypeInfo(type).icon;
  }

  getTransactionColor(type: WalletTransactionType): string {
    return this.walletService.getTransactionTypeInfo(type).color;
  }

  getTransactionLabel(type: WalletTransactionType): string {
    return this.walletService.getTransactionTypeInfo(type).label;
  }

  formatRelativeTime(dateString: string): string {
    return this.walletService.formatRelativeTime(dateString);
  }

  isPositiveTransaction(type: WalletTransactionType): boolean {
    return type === 'CREDIT';
  }

  getSignedAmount(transaction: WalletTransaction): string {
    const sign = this.isPositiveTransaction(transaction.type) ? '+' : '-';
    return `${sign}${this.formatAmount(Math.abs(transaction.amount))}`;
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
  }
}
