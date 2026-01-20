import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonText
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-bank-settings',
  templateUrl: './bank-settings.page.html',
  styleUrls: ['./bank-settings.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonText,
    CommonModule
  ]
})
export class BankSettingsPage {
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/p/profile']);
  }
}
