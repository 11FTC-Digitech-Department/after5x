import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { SessionService } from '../../../../core/auth/session';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonLabel,
    IonAvatar,
    IonIcon,
    IonSpinner,
    CommonModule,
    FormsModule
  ]
})
export class ProfilePage implements OnInit {
  private router = inject(Router);
  private sessionService = inject(SessionService);

  // Logout loading state
  readonly isLoggingOut = signal(false);

  constructor() { }

  ngOnInit() {
  }

  async logout() {
    if (this.isLoggingOut()) {
      return; // Prevent multiple logout attempts
    }

    this.isLoggingOut.set(true);
    console.log('Logging out...');

    try {
      await this.sessionService.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, the SessionService should handle navigation
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
