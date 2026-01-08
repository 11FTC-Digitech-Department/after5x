import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

  constructor() { }

  ngOnInit() {
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }

}
