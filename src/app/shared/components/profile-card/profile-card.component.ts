import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardContent,
  IonAvatar,
  IonIcon,
  IonBadge,
  IonSkeletonText,
  IonText
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-profile-card',
  templateUrl: './profile-card.component.html',
  styleUrls: ['./profile-card.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardContent,
    IonAvatar,
    IonIcon,
    IonBadge,
    IonSkeletonText,
    IonText
  ]
})
export class ProfileCardComponent {
  @Input() fullName = '';
  @Input() avatarUrl?: string;
  @Input() role: 'customer' | 'provider' | 'admin' = 'customer';
  @Input() isVerified = false;
  @Input() rating?: number;
  @Input() totalReviews?: number;
  @Input() memberSince?: string;
  @Input() isLoading = false;
  @Input() isUploadingAvatar = false;

  @Output() avatarClick = new EventEmitter<void>();

  get initials(): string {
    if (!this.fullName) return '?';
    const names = this.fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }

  get roleLabel(): string {
    switch (this.role) {
      case 'provider':
        return 'Service Provider';
      case 'admin':
        return 'Administrator';
      default:
        return 'Customer';
    }
  }

  get formattedRating(): string {
    return this.rating ? this.rating.toFixed(1) : '0.0';
  }

  get hasRating(): boolean {
    return this.role === 'provider' && (this.totalReviews ?? 0) > 0;
  }

  onAvatarClick() {
    if (!this.isLoading && !this.isUploadingAvatar) {
      this.avatarClick.emit();
    }
  }

  getStarIcons(): string[] {
    const rating = this.rating || 0;
    const stars: string[] = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) {
        stars.push('star');
      } else if (rating >= i - 0.5) {
        stars.push('star-half');
      } else {
        stars.push('star-outline');
      }
    }
    return stars;
  }
}
