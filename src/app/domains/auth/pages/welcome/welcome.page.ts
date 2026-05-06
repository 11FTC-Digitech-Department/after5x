import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonFooter
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  standalone: true,
  imports: [IonFooter, 
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    CommonModule,
    FormsModule
  ]
})
export class WelcomePage implements OnInit {
  private router = inject(Router);
  isExpertsApp = signal(false);

  constructor() { }

  ngOnInit() {
    void this.loadAppInfo();
  }

  private async loadAppInfo() {
    try {
      const info = await App.getInfo();
      this.isExpertsApp.set(info.id?.includes('experts') ?? false);
    } catch {
      this.isExpertsApp.set(false);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }

}
