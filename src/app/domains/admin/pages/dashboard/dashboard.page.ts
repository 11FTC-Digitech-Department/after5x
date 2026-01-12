import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, businessOutline, statsChartOutline } from 'ionicons/icons';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    CommonModule
  ]
})
export class DashboardPage implements OnInit {

  constructor() {
    addIcons({ peopleOutline, businessOutline, statsChartOutline });
  }

  ngOnInit() {
    // Load admin dashboard data
  }

}